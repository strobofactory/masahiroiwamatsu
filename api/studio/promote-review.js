import { requireStudioAuth } from '../../lib/studio-auth.js';

const REPO = 'strobofactory/masahiroiwamatsu';
const MAIN = 'main';
const REVIEW = 'review';

async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured.');
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const detail = await res.text().catch(()=>'');
    const error = new Error(`GitHub API failed (${res.status}).`);
    error.status = res.status;
    error.detail = detail.slice(0,500);
    throw error;
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed.'});
  if (!requireStudioAuth(req,res)) return;
  try {
    const compare = await github(`/compare/${MAIN}...${REVIEW}`);
    const aheadBy = Number(compare.ahead_by || 0);
    const behindBy = Number(compare.behind_by || 0);
    if (aheadBy === 0 && behindBy === 0) return res.status(200).json({ok:true,changed:false,message:'レビューと本番は同じ状態です。'});
    if (compare.status !== 'ahead' || behindBy !== 0) {
      return res.status(409).json({error:'review ブランチが main と分岐しています。安全のため本番反映を停止しました。',status:compare.status,aheadBy,behindBy});
    }
    const reviewRef = await github(`/git/ref/heads/${REVIEW}`);
    const reviewSha = reviewRef.object?.sha;
    if (!reviewSha) throw new Error('Could not resolve review branch head.');
    await github(`/git/refs/heads/${MAIN}`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sha:reviewSha,force:false})
    });
    return res.status(200).json({ok:true,changed:true,sha:reviewSha,aheadBy,message:'本サイトへの反映を開始しました。VercelのProduction反映まで少し待ちます。'});
  } catch (error) {
    const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 500;
    return res.status(status).json({error:error instanceof Error ? error.message : 'Unexpected error.'});
  }
}
