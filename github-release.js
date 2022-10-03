module.exports = async ({ github, context }) => {
  let resp, tag_name, commits

  // get latest release
  try {
    resp = await github.rest.repos.getLatestRelease({
      owner: context.repo.owner,
      repo: context.repo.repo
    })
    tag_name = resp.data.tag_name
  } catch (error) {
    if (error.response.status == 404) {
      console.log("No previous release found")
    } else {
      throw error
    }
  }

  // get commits since last release
  if (tag_name) {
    // commit sha of latest release tag
    resp = await github.rest.git.listMatchingRefs({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: `tags/${tag_name}`
    })
    let tag_commit_sha = resp.data[0].object.sha

    resp = await github.rest.git.getCommit({
      owner: context.repo.owner,
      repo: context.repo.repo,
      commit_sha: tag_commit_sha
    })
    let release_commit = resp.data

    // commits since latest release
    resp = await github.rest.repos.listCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      since: release_commit.author.date,
      per_page: 100
    })
    commits = resp.data
    commits.pop()

  // get all commits
  } else {
    resp = await github.rest.repos.listCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      per_page: 100
    })
    commits = resp.data
  }

  let issues = [], commits_without_issues = []

  for (const commit of commits) {
    let message = commit.commit.message
    let repo = context.repo.repo
    const regexp = /(intellum\/[\w-]+)?\(?#\d+\)?/g
    const issue_refs = [...message.matchAll(regexp)].map(e => e[0])

    if (issue_refs.length == 0) {
      let title = message.split('\n')[0]
      commits_without_issues.push({
        `* [${title}](https://github.com/intellum/${repo}/commit/${commit.sha})`
      })
      continue
    }

    for (const issue_ref of issue_refs) {
      if (issue_ref.startsWith('(')) {
        continue
      }

      if (issue_ref.startsWith('intellum')) {
        var [owner_repo, issue_number] = issue_ref.split('#')
        repo = owner_repo.split('/')[1]
      } else {
        var issue_number = issue_ref.replace('#', '')
      }

      resp = await github.rest.issues.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issue_number
      })
      let issue = resp.data

      issues.push({
        `* [${issue.title}](https://github.com/intellum/${repo}/issues/${issue_number})`
      })
    }
  }

  // uniq lists
  issues = [...new Set(issues)]
  commits_without_issues = [...new Set(commits_without_issues)]

  let output = []
  if (issues.length > 0) {
    output = output.concat([
      "\nIssues",
      ...issues
    ])
  }

  if (commits_without_issues.length > 0) {
    output = output.concat([
      "\nCommits without an issue number",
      ...commits_without_issues
    ])
  }

  return output.join("\n")
}
