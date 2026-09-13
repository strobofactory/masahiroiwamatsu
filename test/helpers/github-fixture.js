import crypto from 'node:crypto';

function sha(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function githubFixture(initialFiles = {}) {
  const files = new Map(Object.entries(initialFiles));
  let commitCounter = 0;
  const commits = [];
  let headRevision = 0;

  function fileJson(path) {
    const content = files.get(path);
    return {
      type: 'file',
      name: path.split('/').pop(),
      path,
      sha: sha(`blob:${content}`),
      content: Buffer.from(content, 'utf8').toString('base64')
    };
  }

  async function fetchImpl(input, options = {}) {
    const url = new URL(input);
    const marker = '/repos/strobofactory/masahiroiwamatsu';
    const apiPath = decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
    if (apiPath === '/git/ref/heads/main' && (!options.method || options.method === 'GET')) {
      return json({ object: { sha: sha(`${headRevision}:${[...files.entries()].sort().flat().join('\n')}`) } });
    }
    if (apiPath === '/contents/src/content/notes' && (!options.method || options.method === 'GET')) {
      return json([...files.keys()]
        .filter((path) => path.startsWith('src/content/notes/') && !path.slice('src/content/notes/'.length).includes('/'))
        .map((path) => ({ type: 'file', name: path.split('/').pop(), path, sha: fileJson(path).sha })));
    }
    if (apiPath.startsWith('/contents/')) {
      const path = apiPath.slice('/contents/'.length);
      if (!options.method || options.method === 'GET') {
        if (!files.has(path)) return json({ message: 'Not Found' }, 404);
        return json(fileJson(path));
      }
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body);
        const exists = files.has(path);
        if (exists && body.sha !== fileJson(path).sha) return json({ message: 'sha mismatch' }, 409);
        if (!exists && body.sha) return json({ message: 'missing' }, 409);
        if (exists && !body.sha) return json({ message: 'exists' }, 422);
        const content = Buffer.from(body.content, 'base64').toString('utf8');
        files.set(path, content);
        commitCounter += 1;
        headRevision += 1;
        const commitSha = sha(`commit:${commitCounter}:${path}:${content}`);
        commits.push({ sha: commitSha, path, message: body.message });
        return json({ content: fileJson(path), commit: { sha: commitSha } });
      }
    }
    return json({ message: `Unhandled ${options.method || 'GET'} ${apiPath}` }, 500);
  }

  return { fetchImpl, files, commits };
}
