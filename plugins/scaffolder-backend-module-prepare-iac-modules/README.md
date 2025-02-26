# backstage-plugin-scaffolder-backend-module-prepare-iac-modules

The prepare-iac-modules module for [@backstage/plugin-scaffolder-backend](https://www.npmjs.com/package/@backstage/plugin-scaffolder-backend).

## Overview

The Backstage IaC Custom action Plugin automates the process of preparing Infrastructure as Code (IaC) modules by:

- Deleting unchecked module folders.

- Adding environment-specific Terraform variables (*.tfvars).

- Generating backend configuration files for remote state management.

This plugin integrates into Backstage workflows, ensuring that only the necessary Terraform modules are retained and configured correctly before deployment.

## Features

- Automated Module Cleanup: Removes folders not selected for deployment.

- Environment-Specific Configurations: Generates *.tfvars files based on the selected environment.

- Backend Configuration Management: Creates backend configuration files dynamically.


