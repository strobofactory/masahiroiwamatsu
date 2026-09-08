import { requireStudioAuth } from '../../lib/studio-auth.js';

const REPO = 'strobofactory/masahiroiwamatsu';
const MAIN = 'main';
const REVIEW = 'review';
const PREVIEW_URL = 'https://masahiroiwamatsu-git-review-strobofactorys-projects.vercel.app';

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
    error.detail = detail.slice(0,500);
    throw error;
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed.'});
  if (!requireStudioAuth(req,res)) return;
  try {
    const [mainRef, reviewRef, compare] = await Promise.all([
      github(`/git/ref/heads/${MAIN}`),
      github(`/git/ref/heads/${REVIEW}`),
      github(`/compare/${MAIN}...${REVIEW}`)
    ]);
    return res.status(200).json({
      ok:true,
      mainSha:mainRef.object?.sha || '',
      reviewSha:reviewRef.object?.sha || '',
      status:compare.status || '',
      aheadBy:Number(compare.ahead_by || 0),
      behindBy:Number(compare.behind_by || 0),
      previewUrl:PREVIEW_URL,
      canPromote:compare.status === 'ahead' && Number(compare.behind_by || 0) === 0
    });
  } catch (error) {
    return res.status(500).json({error:error instanceof Error ? error.message : 'Unexpected error.'});
  }
}
