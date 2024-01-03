# backstage-ecs

## Overview

Deployment of Backstage to an ECS Cluster

<!-- BEGINNING OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | ~> 1.4 |
| <a name="requirement_aws"></a> [aws](#requirement\_aws) | ~> 4.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_aws"></a> [aws](#provider\_aws) | 4.67.0 |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_backstage"></a> [backstage](#module\_backstage) | sourcefuse/arc-backstage-ecs-app/aws | 0.2.2 |
| <a name="module_ecs_common_data"></a> [ecs\_common\_data](#module\_ecs\_common\_data) | ../ecs-common-data | n/a |
| <a name="module_tags"></a> [tags](#module\_tags) | sourcefuse/arc-tags/aws | 1.2.3 |

## Resources

| Name | Type |
|------|------|
| [aws_route53_zone.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/route53_zone) | data source |
| [aws_subnets.private](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/subnets) | data source |
| [aws_subnets.public](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/subnets) | data source |
| [aws_vpc.vpc](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/vpc) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_acm_domain_name"></a> [acm\_domain\_name](#input\_acm\_domain\_name) | Domain name the ACM Certificate belongs to | `string` | `"*.arc-poc.link"` | no |
| <a name="input_acm_process_domain_validation_options"></a> [acm\_process\_domain\_validation\_options](#input\_acm\_process\_domain\_validation\_options) | Flag to enable/disable processing of the record to add to the DNS zone to complete certificate validation | `bool` | `false` | no |
| <a name="input_alb_certificate_arn"></a> [alb\_certificate\_arn](#input\_alb\_certificate\_arn) | ALB Certificate ARN. If `var.create_acm_certificate` is `true`, this will be ignored. | `string` | `null` | no |
| <a name="input_alb_internal"></a> [alb\_internal](#input\_alb\_internal) | Determines if this load balancer is internally or externally facing. | `bool` | `false` | no |
| <a name="input_app_host_name"></a> [app\_host\_name](#input\_app\_host\_name) | Host name to expose via Route53 | `string` | `"dx.arc-poc.link"` | no |
| <a name="input_container_image"></a> [container\_image](#input\_container\_image) | url for image being used to setup backstage | `string` | `"spotify/backstage-cookiecutter"` | no |
| <a name="input_create_acm_certificate"></a> [create\_acm\_certificate](#input\_create\_acm\_certificate) | Create an ACM Certificate to use with the ALB | `bool` | `true` | no |
| <a name="input_deploy_backstage"></a> [deploy\_backstage](#input\_deploy\_backstage) | Deploy the Backstage image to the cluster. | `bool` | `true` | no |
| <a name="input_desired_count"></a> [desired\_count](#input\_desired\_count) | Number of ECS tasks to run for the health check. | `number` | `1` | no |
| <a name="input_environment"></a> [environment](#input\_environment) | ID element. Usually used for region e.g. 'uw2', 'us-west-2', OR role 'prod', 'staging', 'dev', 'UAT' | `string` | `"poc"` | no |
| <a name="input_execution_policy_attachment_arns"></a> [execution\_policy\_attachment\_arns](#input\_execution\_policy\_attachment\_arns) | The ARNs of the policies you want to apply | `list(string)` | <pre>[<br>  "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"<br>]</pre> | no |
| <a name="input_namespace"></a> [namespace](#input\_namespace) | Namespace for the resources. | `string` | n/a | yes |
| <a name="input_private_key_secret_name"></a> [private\_key\_secret\_name](#input\_private\_key\_secret\_name) | Name of the secret in AWS Secrets Manager that contains Backstage private key for GitHub authentication. The secret should be stored as plain text in ASM. | `string` | `"arc/poc/sf-arc-poc2-backstage-private-key"` | no |
| <a name="input_region"></a> [region](#input\_region) | AWS region | `string` | `"us-east-1"` | no |
| <a name="input_route_53_private_zone"></a> [route\_53\_private\_zone](#input\_route\_53\_private\_zone) | Used with `name` field to get a private Hosted Zone | `bool` | `false` | no |
| <a name="input_route_53_profile_name"></a> [route\_53\_profile\_name](#input\_route\_53\_profile\_name) | Profile where the Route 53 Zone lives. | `string` | `"poc2"` | no |
| <a name="input_route_53_zone_name"></a> [route\_53\_zone\_name](#input\_route\_53\_zone\_name) | Route53 zone name used for looking up and creating an `A` record for the health check service | `string` | `"arc-poc.link"` | no |
| <a name="input_secret_name"></a> [secret\_name](#input\_secret\_name) | Name of the secret in AWS Secrets Manager that contains Backstage secrets, such as POSTGRES\_USER and POSTGRES\_PASSWORD | `string` | `"arc/poc/sf-arc-poc2-backstage"` | no |

## Outputs

No outputs.
<!-- END OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
