"""Exports to ONNX what the application needs to run an RVC voice. Run from the applio folder,
with its environment.

    python ../export_onnx.py content <out.onnx>
        The content model (ContentVec, MIT licence): sound at 16 kHz in, one row of 768
        numbers per 20 ms out.
    python ../export_onnx.py voice <model.pth> <out.onnx>
        A trained voice: content rows (two per 20 ms), pitch, in; sound out.
"""
import json
import sys

import torch

sys.path.insert(0, ".")


def content(out):
    from rvc.lib.utils import get_hubert_model_class

    model = get_hubert_model_class().from_pretrained("rvc/models/embedders/contentvec").eval()

    class Content(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.model = model

        def forward(self, audio):
            return self.model(audio)["last_hidden_state"]

    torch.onnx.export(
        Content(),
        (torch.zeros(1, 16000),),
        out,
        input_names=["audio"],
        output_names=["units"],
        dynamic_axes={"audio": {1: "samples"}, "units": {1: "frames"}},
        opset_version=17,
        dynamo=False,
    )


def voice(path, out):
    from rvc.lib.algorithm.normalization import LayerNorm
    from rvc.lib.algorithm.synthesizers import Synthesizer

    # The exporter wants the size of a normalisation written down, not read from its input.
    def forward(self, x):
        x = torch.nn.functional.layer_norm(
            x.transpose(1, -1), (self.gamma.shape[0],), self.gamma, self.beta, self.eps
        )
        return x.transpose(1, -1)

    LayerNorm.forward = forward

    cpt = torch.load(path, map_location="cpu", weights_only=False)
    if "model" in cpt:
        # A state saved during training (G_<step>.pth), with the settings next to it.
        import os

        hps = json.load(open(os.path.join(os.path.dirname(path), "config.json")))
        data, model = hps["data"], hps["model"]
        cpt = {
            "weight": {k: v.float() for k, v in cpt["model"].items() if "enc_q" not in k},
            "config": [
                data["filter_length"] // 2 + 1, 32, model["inter_channels"], model["hidden_channels"],
                model["filter_channels"], model["n_heads"], model["n_layers"], model["kernel_size"],
                model["p_dropout"], model["resblock"], model["resblock_kernel_sizes"],
                model["resblock_dilation_sizes"], model["upsample_rates"],
                model["upsample_initial_channel"], model["upsample_kernel_sizes"],
                model["spk_embed_dim"], model["gin_channels"], data["sample_rate"],
            ],
            "sr": data["sample_rate"], "f0": 1, "version": "v2",
            "vocoder": model.get("vocoder", "HiFi-GAN"), "epoch": cpt.get("epoch"),
        }
    cpt["weight"] = {k: v.float() for k, v in cpt["weight"].items()}
    config = list(cpt["config"])
    config[-3] = cpt["weight"]["emb_g.weight"].shape[0]  # how many speakers it was trained with
    use_f0, version, vocoder = cpt.get("f0", 1), cpt.get("version", "v2"), cpt.get("vocoder", "HiFi-GAN")
    dim = 768 if version == "v2" else 256
    net = Synthesizer(*config, use_f0=use_f0, text_enc_hidden_dim=dim, vocoder=vocoder)
    loaded = net.load_state_dict(cpt["weight"], strict=False)
    # Only the part used for training (enc_q) may be absent.
    print("not loaded:", [k for k in loaded.missing_keys if "enc_q" not in k][:5], "unknown:", loaded.unexpected_keys[:5])
    assert not [k for k in loaded.missing_keys if "enc_q" not in k] and not loaded.unexpected_keys
    net.eval().remove_weight_norm()

    class Voice(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.net = net

        def forward(self, feats, p_len, pitch, pitchf, sid):
            return self.net.infer(feats, p_len, pitch, pitchf, sid)[0]

    frames = 200
    torch.onnx.export(
        Voice(),
        (
            torch.zeros(1, frames, dim),
            torch.tensor([frames]),
            torch.ones(1, frames, dtype=torch.long),
            torch.zeros(1, frames),
            torch.tensor([0]),
        ),
        out,
        input_names=["feats", "p_len", "pitch", "pitchf", "sid"],
        output_names=["audio"],
        dynamic_axes={
            "feats": {1: "frames"},
            "pitch": {1: "frames"},
            "pitchf": {1: "frames"},
            "audio": {2: "samples"},
        },
        opset_version=17,
        dynamo=False,
    )
    print(json.dumps({"rate": cpt.get("sr"), "version": version, "f0": use_f0, "vocoder": vocoder, "epoch": cpt.get("epoch")}))


def pitch(samples, out):
    """RMVPE for windows of exactly `samples` at 16 kHz: sound in, one row of 360 pitch
    saliences per 10 ms out. The spectrum is drawn with a convolution, which every engine runs."""
    import numpy as np
    import torch.nn.functional as F
    from rvc.lib.predictors.RMVPE import RMVPE0Predictor

    predictor = RMVPE0Predictor("rvc/models/predictors/rmvpe.pt", device="cpu")
    n_fft, hop = 1024, 160
    window = torch.hann_window(n_fft, dtype=torch.float64)
    at = torch.arange(n_fft, dtype=torch.float64)
    bins = torch.arange(n_fft // 2 + 1, dtype=torch.float64)[:, None]
    angle = 2 * np.pi * bins * at / n_fft
    kernels = torch.cat([torch.cos(angle) * window, -torch.sin(angle) * window]).float()[:, None]

    class Pitch(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.model = predictor.model
            self.register_buffer("kernels", kernels)
            self.register_buffer("mel_basis", predictor.mel_extractor.mel_basis)

        def forward(self, audio):
            padded = F.pad(audio[:, None], (n_fft // 2, n_fft // 2), mode="reflect")
            parts = F.conv1d(padded, self.kernels, stride=hop)
            real, imag = parts[:, : n_fft // 2 + 1], parts[:, n_fft // 2 + 1 :]
            magnitude = torch.sqrt(real * real + imag * imag)
            mel = torch.log(torch.clamp(torch.matmul(self.mel_basis, magnitude), min=1e-5))
            frames = mel.shape[-1]
            mel = F.pad(mel, (0, 32 * ((frames - 1) // 32 + 1) - frames), mode="reflect")
            return self.model(mel)[:, :frames]

    wrapped = Pitch().eval()
    audio = torch.randn(1, samples) * 0.1
    with torch.no_grad():
        ours = wrapped(audio)
        theirs = predictor.mel2hidden(predictor.mel_extractor(audio, center=True))
    print("same as the original:", float((ours - theirs).abs().max()), tuple(ours.shape))
    torch.onnx.export(
        wrapped, (audio,), out, input_names=["audio"], output_names=["salience"],
        opset_version=17, dynamo=False,
    )


if sys.argv[1] == "pitch":
    pitch(int(sys.argv[2]), sys.argv[3])
elif sys.argv[1] == "content":
    content(sys.argv[2])
else:
    voice(sys.argv[2], sys.argv[3])
