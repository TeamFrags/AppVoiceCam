use serde::Serialize;
use serde_json::{Map, Value};

/// Error handed to the interface, which turns `code` into a message for the user.
#[derive(Debug, Clone, Serialize)]
pub struct AppError {
    pub code: String,
    /// Extra fields returned by the API (ban reason, retry delay…).
    pub details: Map<String, Value>,
}

impl AppError {
    pub fn new(code: &str) -> Self {
        Self { code: code.to_string(), details: Map::new() }
    }

    /// Builds the error from an API response body of the form `{ "error": "...", ... }`.
    pub fn from_api(status: u16, body: Value) -> Self {
        let mut details = match body {
            Value::Object(map) => map,
            _ => Map::new(),
        };
        let code = match details.remove("error") {
            Some(Value::String(code)) => code,
            _ => format!("http_{status}"),
        };
        Self { code, details }
    }

    pub fn is(&self, code: &str) -> bool {
        self.code == code
    }
}

impl From<reqwest::Error> for AppError {
    fn from(_: reqwest::Error) -> Self {
        AppError::new("network_error")
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn keeps_the_api_code_and_its_details() {
        let err = AppError::from_api(403, json!({ "error": "account_banned", "reason": "Abus" }));
        assert!(err.is("account_banned"));
        assert_eq!(err.details["reason"], "Abus");
        assert!(!err.details.contains_key("error"));
    }

    #[test]
    fn falls_back_to_the_status_when_the_body_is_not_an_api_error() {
        assert_eq!(AppError::from_api(502, json!("Bad Gateway")).code, "http_502");
    }
}
