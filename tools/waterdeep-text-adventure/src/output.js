export function createOutput({ outputEl }) {
  let printQueue = [];
  let printing = false;

  function enqueue(lines) {
    printQueue.push(...lines);
    if (!printing) drain();
  }

  function drain() {
    if (printQueue.length === 0) {
      printing = false;
      return;
    }
    printing = true;
    const item = printQueue.shift();
    printLine(item);
    const delay = item.type === 'art' ? 0 : item.delay ?? 40;
    setTimeout(drain, delay);
  }

  function printLine(item) {
    if (typeof item === 'string') item = { text: item };
    const div = document.createElement('div');

    if (item.type === 'art') {
      div.className = 'art';
      div.textContent = item.text;
    } else if (item.text === '') {
      div.className = 'line blank';
    } else if (item.text === '---') {
      div.className = 'line divider';
    } else {
      div.className = 'line' + (item.cls ? ' ' + item.cls : '');
      div.textContent = item.text;
    }

    outputEl.appendChild(div);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function print(text, cls, delay) {
    enqueue([{ text, cls, delay }]);
  }

  function printArt(text) {
    enqueue([{ type: 'art', text }]);
  }

  function echo(text) {
    enqueue([{ text: '> ' + text, cls: 'dim', delay: 0 }, { text: '', delay: 0 }]);
  }

  function clear() {
    outputEl.textContent = '';
  }

  return { enqueue, print, printArt, echo, clear };
}

