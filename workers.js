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
  console.log('Frames successfully fetched:', frames.length);
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
      if (frames.length === 0) {
        throw new Error('No frames loaded');
      }

      const urlParams = new URLSearchParams(url.search);
      const opts = validateQuery(urlParams);
      const stream = streamer(frames, opts);

      return new Response(
        new ReadableStream({
          async start(controller) {
            const interval = setInterval(() => {
              try {
                const { frame } = stream();
                console.log('Sending frame:', frame);
                // Convert the frame string into a Uint8Array
                const frameData = new TextEncoder().encode(`\u001b[2J\u001b[3J\u001b[H${frame}\n`);
                controller.enqueue(frameData);
              } catch (err) {
                console.error('Stream error:', err.message);
                clearInterval(interval);
                controller.error(`Stream error: ${err.message}`);
              }
            }, 70); // Frame delay, adjust as needed

            // Close the stream if the connection is terminated
            request.signal.addEventListener('abort', () => {
              console.log('Request aborted, closing stream.');
              clearInterval(interval);
              controller.close();
            });
          },
        }),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    } catch (err) {
      console.error('Error:', err.message);
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
