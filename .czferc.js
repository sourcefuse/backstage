const types = [
  { value: 'feat', name: 'feat:     A new feature' },
  { value: 'fix', name: 'fix:      A bug fix' },
  { value: 'docs', name: 'docs:     Documentation only changes' },
  {
    value: 'style',
    name: 'style:    Changes that do not affect the meaning of the code\n            (white-space, formatting, missing semi-colons, etc)',
  },
  {
    value: 'refactor',
    name: 'refactor: A code change that neither fixes a bug nor adds a feature',
  },
  {
    value: 'perf',
    name: 'perf:     A code change that improves performance',
  },
  { value: 'test', name: 'test:     Adding missing tests' },
  {
    value: 'chore',
    name: 'chore:    Changes to the build process or auxiliary tools\n            and libraries such as documentation generation',
  },
  { value: 'revert', name: 'revert:   Revert to a commit' },
  { value: 'WIP', name: 'WIP:      Work in progress' },
];

const scopes = [
  { name: 'chore' },
  { name: 'deps' },
  { name: 'core' },
  { name: 'templates' },
  { name: 'actions' },
  { name: 'plugins' },
];

/**
 * @typedef {{type: string; scope: string; subject: string; body: string; isBreaking: boolean; breakingBody: string; breaking: string; isIssueAffected: boolean; issuesBody: string; issues: string;}} Answers
 */

/** @type import('cz-format-extension').Config<Answers> */
module.exports = {
  questions({ inquirer, gitInfo }) {
    return [
      {
        type: 'list',
        name: 'type',
        message: 'Select type',
        choices: types,
      },
      {
        type: 'list',
        name: 'scope',
        message: 'Denote the SCOPE of this change (optional):\n',
        choices: scopes,
      },
      {
        type: 'input',
        name: 'subject',
        message: 'Write a SHORT, IMPERATIVE tense description of the change:\n',
        validate: subject =>
          subject.length === 0 ? 'subject is required' : true,
      },
      {
        type: 'input',
        name: 'body',
        message:
          'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
      },
      {
        type: 'input',
        name: 'breaking',
        message: 'List any BREAKING CHANGES (optional):\n',
      },
      {
        type: 'input',
        name: 'issues',
        message:
          'List any ISSUES CLOSED by this change (optional). E.g.: #31, #34:\n',
        filter: (input, answers) => {
          return input.replace(/^\#/g, 'gh-');
        },
      },
      {
        type: 'expand',
        name: 'confirmCommit',
        choices: [
          { key: 'y', name: 'Yes', value: 'yes' },
          { key: 'n', name: 'Abort commit', value: 'no' },
        ],
        default: 0,
        message(answers) {
          const SEP =
            '###--------------------------------------------------------###';
          console.log(
            `\n${SEP}\n${buildCommit({ answers, gitInfo })}\n${SEP}\n`,
          );
          return 'Are you sure you want to proceed with the commit above?';
        },
      },
    ];
  },
  commitMessage({ answers, gitInfo }) {
    if (answers.confirmCommit === 'yes') {
      return buildCommit({ answers, gitInfo });
    } else {
      throw Error('Commit cancelled.');
    }
  },
};

function buildCommit({ answers, gitInfo }) {
  const scope = answers.scope ? `(${answers.scope})` : false;
  const head = `${answers.type}${scope}: ${answers.subject}`;
  const body = answers.body ? answers.body : false;
  const breaking = answers.breaking
    ? `BREAKING CHANGE:\n${answers.breaking}`
    : false;
  const issues = answers.issues
    ? answers.issues.split(', ').join('\n').valueOf()
    : false;

  return escapeSpecialChars(
    [head, body, breaking, issues].filter(p => p).join('\n\n'),
  );
}

const escapeSpecialChars = result => {
  // eslint-disable-next-line no-useless-escape
  const specialChars = ['`'];

  let newResult = result;
  // eslint-disable-next-line array-callback-return
  specialChars.map(item => {
    // If user types "feat: `string`", the commit preview should show "feat: `\string\`".
    // Don't worry. The git log will be "feat: `string`"
    newResult = result.replace(new RegExp(item, 'g'), '\\`');
  });
  return newResult;
};
