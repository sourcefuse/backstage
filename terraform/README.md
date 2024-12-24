# Backstage ECS

## Overview

Deployment of Backstage to an ECS Cluster

<!-- BEGINNING OF PRE-COMMIT-TERRAFORM DOCS HOOK -->

## Requirements

| Name                                                                     | Version |
| ------------------------------------------------------------------------ | ------- |
| <a name="requirement_terraform"></a> [terraform](#requirement_terraform) | ~> 1.4  |
| <a name="requirement_aws"></a> [aws](#requirement_aws)                   | ~> 4.0  |

## Providers

| Name                                             | Version |
| ------------------------------------------------ | ------- |
| <a name="provider_aws"></a> [aws](#provider_aws) | 4.67.0  |

## Modules

| Name                                                                             | Source                                                   | Version |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- | ------- |
| <a name="module_backstage"></a> [backstage](#module_backstage)                   | git::https://github.com/sourcefuse/arc-backstage-ecs-app | n/a     |
| <a name="module_ecs_common_data"></a> [ecs_common_data](#module_ecs_common_data) | ./ecs-common-data                                        | n/a     |
| <a name="module_tags"></a> [tags](#module_tags)                                  | sourcefuse/arc-tags/aws                                  | 1.2.3   |

## Resources

| Name                                                                                                                                                     | Type        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| [aws_route53_zone.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/route53_zone)                                  | data source |
| [aws_ssm_parameter.container_image](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter)                        |
| data source                                                                                                                                              |
| [aws_ssm_parameter.sonarcloud_token](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter) data source           |
| [aws_ssm_parameter.repo_name](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter)                              | data source |
| [aws_subnets.private](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/subnets)                                            | data source |
| [aws_subnets.public](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/subnets)                                             | data source |
| [aws_vpc.vpc](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/vpc)                                                        | data source |
| [aws_ssm_parameter.jenkins_baseurl1](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter) data source           |
| [aws_ssm_parameter.jenkins_username1](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter) data source          |
| [aws_ssm_parameter.jenkins_projectcountlimit1](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter) data source |
| [aws_ssm_parameter.jenkins_apitoken1](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/ssm_parameter) data source          |

## Inputs

| Name                                                                                                                                             | Description                                                                                                                                                | Type           | Default                                                                                       | Required |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------- | :------: |
| <a name="input_acm_domain_name"></a> [acm_domain_name](#input_acm_domain_name)                                                                   | Domain name the ACM Certificate belongs to                                                                                                                 | `string`       | `"*.arc-poc.link"`                                                                            |    no    |
| <a name="input_acm_process_domain_validation_options"></a> [acm_process_domain_validation_options](#input_acm_process_domain_validation_options) | Flag to enable/disable processing of the record to add to the DNS zone to complete certificate validation                                                  | `bool`         | `false`                                                                                       |    no    |
| <a name="input_alb_certificate_arn"></a> [alb_certificate_arn](#input_alb_certificate_arn)                                                       | ALB Certificate ARN. If `var.create_acm_certificate` is `true`, this will be ignored.                                                                      | `string`       | `null`                                                                                        |    no    |
| <a name="input_alb_internal"></a> [alb_internal](#input_alb_internal)                                                                            | Determines if this load balancer is internally or externally facing.                                                                                       | `bool`         | `false`                                                                                       |    no    |
| <a name="input_app_host_name"></a> [app_host_name](#input_app_host_name)                                                                         | Host name to expose via Route53                                                                                                                            | `string`       | `"dx.arc-poc.link"`                                                                           |    no    |
| <a name="input_container_image_override"></a> [container_image_override](#input_container_image_override)                                        | Container image URL where the image is located                                                                                                             | `string`       | `null`                                                                                        |    no    |
| <a name="input_create_acm_certificate"></a> [create_acm_certificate](#input_create_acm_certificate)                                              | Create an ACM Certificate to use with the ALB                                                                                                              | `bool`         | `true`                                                                                        |    no    |
| <a name="input_deploy_backstage"></a> [deploy_backstage](#input_deploy_backstage)                                                                | Deploy the Backstage image to the cluster.                                                                                                                 | `bool`         | `true`                                                                                        |    no    |
| <a name="input_desired_count"></a> [desired_count](#input_desired_count)                                                                         | Number of ECS tasks to run for the health check.                                                                                                           | `number`       | `1`                                                                                           |    no    |
| <a name="input_environment"></a> [environment](#input_environment)                                                                               | ID element. Usually used for region e.g. 'uw2', 'us-west-2', OR role 'prod', 'staging', 'dev', 'UAT'                                                       | `string`       | `"poc"`                                                                                       |    no    |
| <a name="input_ephemeral_storage"></a> [ephemeral_storage](#input_ephemeral_storage)                                                             | (optional) Ephemeral storage for task                                                                                                                      | `string`       | `20`                                                                                          |    no    |
| <a name="input_execution_policy_attachment_arns"></a> [execution_policy_attachment_arns](#input_execution_policy_attachment_arns)                | The ARNs of the policies you want to apply                                                                                                                 | `list(string)` | <pre>[<br> "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"<br>]</pre> |    no    |
| <a name="input_namespace"></a> [namespace](#input_namespace)                                                                                     | Namespace for the resources.                                                                                                                               | `string`       | n/a                                                                                           |   yes    |
| <a name="input_private_key_secret_name"></a> [private_key_secret_name](#input_private_key_secret_name)                                           | Name of the secret in AWS Secrets Manager that contains Backstage private key for GitHub authentication. The secret should be stored as plain text in ASM. | `string`       | `"arc/poc/sf-arc-poc2-backstage-private-key"`                                                 |    no    |
| <a name="input_region"></a> [region](#input_region)                                                                                              | AWS region                                                                                                                                                 | `string`       | `"us-east-1"`                                                                                 |    no    |
| <a name="input_route_53_private_zone"></a> [route_53_private_zone](#input_route_53_private_zone)                                                 | Used with `name` field to get a private Hosted Zone                                                                                                        | `bool`         | `false`                                                                                       |    no    |
| <a name="input_route_53_zone_name"></a> [route_53_zone_name](#input_route_53_zone_name)                                                          | Route53 zone name used for looking up and creating an `A` record for the health check service                                                              | `string`       | `"arc-poc.link"`                                                                              |    no    |
| <a name="input_secret_name"></a> [secret_name](#input_secret_name)                                                                               | Name of the secret in AWS Secrets Manager that contains Backstage secrets, such as POSTGRES_USER and POSTGRES_PASSWORD                                     | `string`       | `"arc/poc/sf-arc-poc2-backstage"`                                                             |    no    |

## Outputs

No outputs.

<!-- END OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
