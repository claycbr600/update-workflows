module.exports = async ({github, context}) => {
  let resp = await github.rest.repos.getLatestRelease({
    owner: context.repo.owner,
    repo: context.repo.repo
  })
  let tag_name = resp.data.tag_name

  // sha of latest release tag
  resp = await github.rest.git.listMatchingRefs({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: `tags/${tag_name}`
  })
  let tag_sha = resp.data[0].object.sha

  resp = await github.rest.git.getCommit({
    owner: context.repo.owner,
    repo: context.repo.repo,
    commit_sha: tag_sha
  })
  let release_commit = resp.data

  // commits since latest release
  resp = await github.rest.repos.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    since: release_commit.author.date
  })
  let commits = resp.data

  commits.pop()
  let issues = []
  let commits_without_issues = []

  commits.forEach(commit => {
    let message = commit.commit.message
    let repo = context.repo.repo
    const regexp = /(intellum\/[\w-]+)?\(?#\d+\)?/g
    const issue_refs = [...message.matchAll(regexp)].map(e => e[0])

    if (issue_refs.length == 0) {
      commits_without_issues.push({
        repo: repo,
        sha: commit.sha,
        message: message.split('\n')[0]
      })
      return
    }

    issue_refs.forEach(issue_ref => {
      if (issue_ref.startsWith('(')) {
        return
      }

      if (issue_ref.startsWith('claycbr600')) {
        let [owner_repo, issue_number] = issue_ref.split('#')
        issues.push({
          repo: owner_repo.split('/')[1],
          issue: issue_number
        })
      } else {
        issues.push({
          repo: repo,
          issue: issue_ref.replace('#', '')
        })
      }
    })
  })

  return {
    issues: issues,
    commits_without_issues: commits_without_issues
  }
}
