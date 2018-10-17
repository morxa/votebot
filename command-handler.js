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
  return comments.reverse()
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
