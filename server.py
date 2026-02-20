from http.server import SimpleHTTPRequestHandler, HTTPServer
import os

class ErrorLoggingHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/log-error':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            print(f"BROWSER ERROR: {post_data}")
            self.send_response(200)
            self.end_headers()
        else:
            super().do_POST()

if __name__ == '__main__':
    # Inject error logger into index.html
    with open('index.html', 'r') as f:
        html = f.read()
        
    injector = """
    <script>
    window.onerror = function(message, source, lineno, colno, error) {
        fetch('/log-error', {
            method: 'POST',
            body: message + ' at ' + source + ':' + lineno
        });
    };
    window.addEventListener('unhandledrejection', function(event) {
        fetch('/log-error', {
            method: 'POST',
            body: 'Unhandled Promise Rejection: ' + event.reason
        });
    });
    </script>
    """
    if '/log-error' not in html:
        html = html.replace('<head>', '<head>' + injector)
        with open('index.html', 'w') as f:
            f.write(html)
            
    print("Server running on port 8081. Errors will be printed here.")
    server = HTTPServer(('0.0.0.0', 8081), ErrorLoggingHandler)
    # just run it for a few seconds using a timeout or thread, but we'll run it in background
    server.serve_forever()
