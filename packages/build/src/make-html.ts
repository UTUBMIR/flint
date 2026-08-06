export function makeHtml(js: string, preview: boolean): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Build</title></head>
<style>
html {
    height: 100%;
    width: 100%;
}
:root {
    touch-action: none;
    height: 100%;

    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}
body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #222;
}
canvas {
    position: absolute;
}
#root {
    width: 100%;
    height: 100%;
    touch-action: none;
}
</style>
<body>
<div id="root"></div>
<script>
${preview ? "window.FLINT_PREVIEW = true;" : ""}
${js}
</script>
</body>
</html>`;
}
