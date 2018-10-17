async function getIssueComments(context) {
  let comments = []
  let page = 1
  let count
  do {
    const result = await context.github.issues.getComments(context.issue({
      per_page: 100,
      page: page
    }))
    const newComments = result['data']
    count = newComments.length
    context.log.debug(`Received ${count} comments in iteration ${page}`)
    comments = comments.concat(newComments)
    page += 1
  } while (count > 0)
  context.log.info(`Received ${comments.length} comments`)
  return comments
}

class VotingInfo {
  constructor(comments) {
    this.comments = comments.reverse()
    // console.log(this.comments)
    for (const comment of this.comments) {
      const command = comment.body.match(/^\/(\w+)\b * (\w+)\b *(.*)?$/m)
      console.log(command)
      if (command && command[1] === 'vote' && command[2] === 'init') {
        this.voters = command[3].split(' ').filter(s => s.length > 0)
        this.start_date = new Date(comment['updated_at'])
        this.quorum = 0.5 // TODO: make the quorum configurable
        break
      }
    }
  }
}

module.exports = async (context, command) => {
  const args = command.arguments.split(' ')
  if (args[0] === 'init') {
    const voters = args.slice(1)
    for (const voter of voters) {
      if (voter[0] !== '@') {
        context.log.error('Please mention all voters with "@"')
        context.github.issues.createComment(context.issue({
          body: 'Error in "init": Please mention all voters with "@"'
        }))
        return
      }
      // TODO: check that user actually exists
      // context.github.search.users({q: voter + ' type:user'})
    }
    context.github.issues.createComment(context.issue({
      body: 'Voting initialized. Expecting votes from ' + voters.toString()
    }))
    context.github.issues.addLabels(context.issue({
      labels: ['vote-in-progress']
    }))
  } else if (args[0] === 'status') {
    const comments = await getIssueComments(context)
    context.log.debug('Received the following comments:\n' + comments)
    // const votingInfo = new VotingInfo(getIssueComments(context))
  }
}
