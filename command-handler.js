async function getIssueComments(context) {
  let comments = []
  let page = 1
  let count
  do {
    const result = await context.github.issues.getComments(
      context.issue({
        per_page: 100,
        page: page
      })
    )
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
    this.comments = comments.sort(
      // descending order by date
      (c1, c2) => new Date(c2['updated_at']) - new Date(c1['updated_at'])
    )
    for (const comment of this.comments) {
      const command = comment.body.match(/^\/(\w+)\b * (\w+)\b *(.*)?$/m)
      if (command && command[1] === 'vote' && command[2] === 'init') {
        this.voters = new Set(command[3].split(' ').filter(s => s.length > 0))
        this.start_date = new Date(comment['updated_at'])
        this.quorum = 0.5 // TODO: make the quorum configurable
        break
      }
    }
    this.pro = new Set()
    this.contra = new Set()
    this.abstain = new Set()
    let processed_voters = new Set()
    for (const comment of this.comments) {
      let commentDate = new Date(comment['updated_at'])
      if (commentDate < this.start_date) {
        continue
      }
      const command = comment.body.match(/^\/(\w+)\b *(.*)?$/m)
      if (command && command[1] === 'vote') {
        let voter = '@' + comment['user']['login']
        if (!processed_voters.has(voter) && this.voters.has(voter)) {
          processed_voters.add(voter)
          const vote = command[2].trim()
          if (vote === '+1' || vote === 'yes') {
            this.pro.add(voter)
          } else if (vote === '-1' || vote === 'no') {
            this.contra.add(voter)
          } else if (vote === '0' || vote === 'abstain') {
            this.abstain.add(voter)
          }
        }
      }
    }
  }

  get votesRequired() {
    return Math.floor(this.quorum * this.voters.size) + 1
  }

  get isCompleted() {
    return (
      this.pro.size >= this.votesRequired ||
      this.contra.size >= this.votesRequired ||
      this.pro.size + this.contra.size + this.abstain.size === this.voters.size
    )
  }

  get result() {
    const proCount = this.pro.size
    const contraCount = this.contra.size
    const abstainCount = this.abstain.size
    const totalVotes = proCount + contraCount + abstainCount
    if (!this.isCompleted) {
      let missingVotes = []
      for (const voter of this.voters) {
        if (
          !this.pro.has(voter) &&
          !this.contra.has(voter) &&
          !this.abstain.has(voter)
        ) {
          missingVotes.push(voter)
        }
      }
      return (
        'Vote not completed yet. Need a majority of ' +
        this.votesRequired +
        ' votes to pass or reject the proposal.\n' +
        'Missing votes from: ' +
        missingVotes.join(', ')
      )
    } else if (proCount > contraCount && proCount >= this.votesRequired) {
      return (
        'ACCEPTED, received ' +
        proCount +
        ' of ' +
        totalVotes +
        ' votes in favor the proposal, needed ' +
        this.votesRequired
      )
    } else if (
      contraCount > this.pro.size &&
      contraCount >= this.votesRequired
    ) {
      return (
        'REJECTED, received ' +
        contraCount +
        ' of ' +
        totalVotes +
        ' votes against the proposal, needed ' +
        this.votesRequired
      )
    } else {
      return (
        'TIED, no majority for either side. In favor: ' +
        this.pro.size +
        ', against: ' +
        contraCount +
        ', needed: ' +
        this.votesRequired
      )
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
        context.github.issues.createComment(
          context.issue({
            body: 'Error in "init": Please mention all voters with "@"'
          })
        )
        return
      }
      // TODO: check that user actually exists
      // context.github.search.users({q: voter + ' type:user'})
    }
    context.github.issues.createComment(
      context.issue({
        body: 'Voting initialized. Expecting votes from ' + voters.toString()
      })
    )
    context.github.issues.addLabels(
      context.issue({
        labels: ['vote-in-progress']
      })
    )
  } else if (args[0] === 'status') {
    const comments = await getIssueComments(context)
    context.log.debug('Received the following comments:\n' + comments)
    const votingInfo = new VotingInfo(comments)
    context.github.issues.createComment(
      context.issue({
        body: votingInfo.result
      })
    )
  } else {
    let labelPromise = context.github.issues.getIssueLabels(context.issue())
    let commentsPromise = getIssueComments(context)
    labelPromise.then(labels => {
      if (labels['data'].filter(label => label.name == 'vote-in-progress')) {
        commentsPromise.then(comments => {
          const votingInfo = new VotingInfo(comments)
          if (votingInfo.isCompleted) {
            context.github.issues.createComment(
              context.issue({ body: votingInfo.result })
            )
            context.github.issues.removeLabel(
              context.issue({ name: 'vote-in-progress' })
            )
            context.github.issues.addLabels(
              context.issue({ labels: ['vote-completed'] })
            )
          }
        })
      }
    })
  }
}
