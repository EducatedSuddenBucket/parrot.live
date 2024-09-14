const framesBaseUrl = 'https://raw.githubusercontent.com/EducatedSuddenBucket/parrot.live/master/frames/';

// Fetch frames dynamically from GitHub
async function fetchFrames() {
  const frames = [];
  for (let i = 0; i <= 9; i++) {
    const response = await fetch(`${framesBaseUrl}${i}.txt`);
    if (!response.ok) {
      throw new Error(`Failed to load frame ${i}.txt`);
    }
    const frame = await response.text();
    frames.push(frame);
  }
  return frames;
}

const colorsOptions = [
  'red',
  'yellow',
  'green',
  'blue',
  'magenta',
  'cyan',
  'white'
];
const numColors = colorsOptions.length;

const selectColor = (previousColor) => {
  let color;
  do {
    color = Math.floor(Math.random() * numColors);
  } while (color === previousColor);
  return color;
};

const streamer = (frames, opts) => {
  let index = 0;
  let lastColor;
  const flippedFrames = frames.map(f => f.split('').reverse().join(''));
  const selectedFrames = opts.flip ? flippedFrames : frames;

  return () => {
    const newColor = lastColor = selectColor(lastColor);
    const frame = selectedFrames[index];
    index = (index + 1) % selectedFrames.length;
    return { frame, color: colorsOptions[newColor] };
  };
};

const validateQuery = (urlParams) => ({
  flip: String(urlParams.get('flip')).toLowerCase() === 'true'
});

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/healthcheck') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (
      request.headers.get('user-agent') &&
      !request.headers.get('user-agent').includes('curl')
    ) {
      return Response.redirect('https://github.com/hugomd/parrot.live', 302);
    }

    try {
      const frames = await fetchFrames();
      const urlParams = new URLSearchParams(url.search);
      const opts = validateQuery(urlParams);
      const stream = streamer(frames, opts);

      let frameCount = 0;

      return new Response(
        new ReadableStream({
          async start(controller) {
            const interval = setInterval(() => {
              const { frame } = stream();
              // Use the correct Unicode escape sequences for clearing the screen
              controller.enqueue(`\u001b[2J\u001b[3J\u001b[H${frame}\n`);
              frameCount++;
              if (frameCount >= frames.length) {
                clearInterval(interval);
                controller.close();
              }
            }, 70);
          },
        }),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
