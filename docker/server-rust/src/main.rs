use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::post,
    Router,
};
use http_body_util::BodyExt;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

// Middleware to inject CORS and Cache-Control headers
async fn custom_headers_middleware(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_owned();
    let method = req.method().clone();
    
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    // 1. Inject CORS headers required for OpenSpeedTest
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Accept,Authorization,Cache-Control,Content-Type,DNT,If-Modified-Since,Keep-Alive,Origin,User-Agent,X-Mx-ReqToken,X-Requested-With"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, OPTIONS"),
    );

    // 2. Handle CORS Preflight OPTIONS requests
    if method == Method::OPTIONS {
        *response.status_mut() = StatusCode::OK;
        return response;
    }

    // 3. Set Cache-Control specific to speedtest files
    if path == "/" || path.ends_with(".html") || path.contains("downloading") || path.contains("upload") {
        headers.insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-store, no-cache, max-age=0, must-revalidate, no-transform"),
        );
    } else {
        // Cache compiled static assets (js, css, fonts)
        headers.insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        );
    }

    response
}

// Upload handler: Streams and discards incoming bytes immediately to avoid memory allocations
async fn upload_handler(mut body: Body) -> impl IntoResponse {
    while let Some(frame_result) = body.frame().await {
        if frame_result.is_err() {
            break;
        }
        // Frame is dropped and freed here
    }
    StatusCode::OK
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        // Handle POST requests to /upload or /speedtest/upload
        .route("/upload", post(upload_handler))
        .route("/speedtest/upload", post(upload_handler))
        // Fallback to serving Vite static assets
        .fallback_service(ServeDir::new("/usr/share/nginx/html"))
        // Apply custom headers middleware
        .layer(middleware::from_fn(custom_headers_middleware));

    let port = std::env::var("HTTP_PORT").unwrap_or_else(|_| "3000".to_string());
    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
    let listener = TcpListener::bind(addr).await.unwrap();
    
    println!("Running OpenSpeedTest Rust Server on http://{}", addr);
    axum::serve(listener, app).await.unwrap();
}
