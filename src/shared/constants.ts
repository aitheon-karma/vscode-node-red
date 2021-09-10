// TODO: Move these to html, had problems with linking prod build to a html file

const BASE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Loading</title>
  <style>
    html {
      height: 100%;
    }
    body {
      background-color: #181818;
      display:flex;
      height: 100%;
      align-items: center;
      justify-content:center;
    }
    code {
      color: white;
    }
  </style>
</head>
<body>  
  <code>
  {{ text }}
  </code>
</body>
</html>`;

export {BASE_HTML};