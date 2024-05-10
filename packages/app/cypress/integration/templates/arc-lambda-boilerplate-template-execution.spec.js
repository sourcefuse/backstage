describe('SourceFuse Backstage Template Execution', () => {
  const frontendBaseUrl = Cypress.env('FRONTEND_BASE_URL');
  const templateUrl = `${frontendBaseUrl}/create/templates/default/arc-lambda-boilerplate`;
  const randVal = Math.floor(Math.random() * 1000);
  const timeOutVal = 50000;
  it('should execute the template ARC Lambda Boilerplate', () => {
    // Visit the page where the template can be executed
    cy.visit(templateUrl);
    cy.contains('Create a New Component', { timeout: timeOutVal }).should(
      'be.visible',
    );
    cy.get('input#root_function_id', { timeout: 50000 }).type(
      `lambda-bolierplate-${randVal}`,
    );
    cy.get('input#root_backstage_namespace').type(
      `nm-lambda-bolierplate-${randVal}`,
    );
    cy.get('input#root_description').type(
      `Description of lambda-bolierplate-${randVal}`,
    );
    cy.get('form')
      .should('have.class', 'rjsf')
      .should('have.length', 1)
      .submit({ timeout: timeOutVal });
    cy.get('input#ownerInput').type(Cypress.env('ORGANIZATION'));
    cy.get('input#repoNameInput').type(`repo-lambda-bolierplate-${randVal}`);
    cy.get('form')
      .should('have.class', 'rjsf')
      .should('have.length', 1)
      .submit({ timeout: timeOutVal });
    cy.get('button:last').click({ timeout: timeOutVal });
    cy.contains('Finished step Register', { timeout: timeOutVal }).should(
      'be.visible',
    );
  });
});
