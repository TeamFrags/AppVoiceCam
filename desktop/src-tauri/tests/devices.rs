//! Lists capture devices through the real drivers. It only enumerates: no camera or microphone
//! is opened, so nothing lights up. Ignored by default because the result depends on the PC.

#[test]
#[ignore]
fn enumerates_devices_without_opening_them() {
    let devices = app_lib::capture::list_devices();
    println!("cameras: {}", devices.cameras.len());
    for camera in &devices.cameras {
        println!("  [{}] {}", camera.id, camera.name);
    }
    println!("microphones: {}", devices.microphones.len());
    for microphone in &devices.microphones {
        println!("  {}", microphone.name);
    }
    for device in devices.cameras.iter().chain(&devices.microphones) {
        assert!(!device.id.is_empty() && !device.name.is_empty());
    }
}
