const { Application } = require('probot')
// Requiring our app implementation
const myProbotApp = require('..')

const rewire = require('rewire')
const commandHandler = rewire('../command-handler')

const issuesOpenedPayload = require('./fixtures/issues.opened.json')
const issueCommentOpenedUnrelated = require('./fixtures/issue_comment.created.unrelated.json')
const issueCommentInit = require('./fixtures/issue_comment.created.init.json')
const issueCommentInvalidInit = require('./fixtures/issue_comment.created.invalid_init.json')
const issueCommentStatus = require('./fixtures/issue_comment.created.status.json')
const issueComments = require('./fixtures/issue_comments.json')

test('that we can run tests', () => {
  // your real tests go here
  expect(1 + 2 + 3).toBe(6)
})

describe('Votebot', () => {
  let app, github

  beforeEach(() => {
    app = new Application()
    // Initialize the app based on the code from index.js
    app.load(myProbotApp)
    // This is an easy way to mock out the GitHub API
    github = {
      issues: {
        createComment: jest.fn().mockReturnValue(Promise.resolve({})),
        addLabels: jest.fn().mockReturnValue(Promise.resolve({})),
        getComments: jest.fn().mockReturnValueOnce(
          Promise.resolve(issueComments)).mockReturnValueOnce({'data': []})
      }
    }
    // Passes the mocked out GitHub API into out app instance
    app.auth = () => Promise.resolve(github)
  })

  test('creates a comment when an issue is opened', async () => {
    // Simulates delivery of an issues.opened webhook
    await app.receive({
      name: 'issues.opened',
      payload: issuesOpenedPayload
    })

    // This test passes if the code in your index.js file calls `context.github.issues.createComment`
    expect(github.issues.createComment).toHaveBeenCalled()
  })
  test('does nothing with a new unrelated comment', async() => {
    await app.receive({
      name: 'issue_comment.created',
      payload: issueCommentOpenedUnrelated
    })

    expect(github.issues.createComment).not.toHaveBeenCalled()
  })
  test('initializes a vote on init command', async() => {
    await app.receive({
      name: 'issue_comment.created',
      payload: issueCommentInit
    })

    expect(github.issues.createComment).toHaveBeenCalled()
    expect(github.issues.addLabels).toHaveBeenCalled()
    expect(github.issues.addLabels.mock.calls[0][0]).toMatchObject({labels: ['vote-in-progress']})
  })
  test('prints an error on init with invalid username', async() => {
    await app.receive({
      name: 'issue_comment.created',
      payload: issueCommentInvalidInit
    })
    expect(github.issues.createComment).toHaveBeenCalled()
    expect(github.issues.createComment.mock.calls[0][0]['body']).toMatch(/Error/)
    expect(github.issues.addLabels).not.toHaveBeenCalled()
  })
  test('prints a status comment', async() => {
    await app.receive({
      name: 'issue_comment.created',
      payload: issueCommentStatus
    })
    expect(github.issues.getComments).toHaveBeenCalled()
  })
})

describe('VotingInfo', () => {
  test('sets the correct start date', async() => {
    const VotingInfo = commandHandler.__get__('VotingInfo')
    const votingInfo = new VotingInfo(issueComments['data'])
    expect(votingInfo.start_date).toMatchObject(
      new Date('2018-10-17T11:31:54Z'))
  })
})

// For more information about testing with Jest see:
// https://facebook.github.io/jest/
