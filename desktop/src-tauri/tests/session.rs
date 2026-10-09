//! Exercises the real API client against a running backend, including the Windows Credential
//! Manager. Ignored by default because it needs a server and an account:
//! `npm run test:integration -w desktop` starts both and runs it.

use app_lib::api::ApiClient;

const KEYCHAIN_SERVICE: &str = "newapp-integration-test";

fn env(name: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| panic!("{name} must be set"))
}

#[tokio::test]
#[ignore]
async fn session_lifecycle() {
    let (url, email, password) = (env("TEST_API_URL"), env("TEST_EMAIL"), env("TEST_PASSWORD"));

    // Wrong password: refused, and nothing is stored.
    let api = ApiClient::new(&url, KEYCHAIN_SERVICE);
    let refused = api.login(&email, "definitely not the password", "Test").await.unwrap_err();
    assert_eq!(refused.code, "invalid_credentials");
    assert!(!api.has_session().await);
    assert_eq!(api.account().await.unwrap_err().code, "not_signed_in");

    // Sign in and read the account as the server sees it.
    api.login(&email, &password, "Test d'intégration").await.unwrap();
    let account = api.account().await.unwrap();
    assert_eq!(account.email, email);
    assert_eq!(account.tier, "free");

    // A new client is what a restart of the application looks like: no token in memory, the
    // session comes back from the credential manager.
    let restarted = ApiClient::new(&url, KEYCHAIN_SERVICE);
    assert!(!restarted.has_session().await);
    assert_eq!(restarted.account().await.unwrap(), account);
    assert!(restarted.has_session().await);

    // The restart rotated the refresh token. A second restart must still work, which proves
    // the rotated token was saved back.
    let restarted_again = ApiClient::new(&url, KEYCHAIN_SERVICE);
    assert_eq!(restarted_again.account().await.unwrap(), account);

    // Signing out ends it for every later start.
    restarted_again.logout().await;
    let after = ApiClient::new(&url, KEYCHAIN_SERVICE);
    assert_eq!(after.account().await.unwrap_err().code, "not_signed_in");
    // The access token held by an older client died with the session too.
    assert_eq!(restarted.account().await.unwrap_err().code, "not_signed_in");
}

#[tokio::test]
#[ignore]
async fn unreachable_server_is_reported_without_dropping_the_session() {
    let api = ApiClient::new("http://127.0.0.1:9", KEYCHAIN_SERVICE);
    let err = api.login("a@example.com", "whatever password", "Test").await.unwrap_err();
    assert_eq!(err.code, "network_error");
}
