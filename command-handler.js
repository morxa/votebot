module.exports = (context, command) => {
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
  }
}
