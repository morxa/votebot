module.exports = (context, command) => {
  const args = command.arguments.split(' ')
  if (args[0] === 'init') {
    context.github.issues.createComment(context.issue({
      body: 'Voting initialized. Expecting votes from ' + args.slice(1).toString()
    }))
  }
}
