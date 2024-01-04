################################################################################
## defaults
################################################################################
terraform {
  required_version = "~> 1.4"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region = var.region
}

module "tags" {
  source  = "sourcefuse/arc-tags/aws"
  version = "1.2.3"

  environment = var.environment
  project     = "refarch-devops-infra"

  extra_tags = {
    MonoRepo     = "True"
    MonoRepoPath = "terraform/ecs"
  }
}

################################################################################
## locals
################################################################################
locals {
  route_53_zone       = trimprefix(var.acm_domain_name, "*.")
  health_check_domain = "healthcheck-${var.namespace}-${var.environment}.${local.route_53_zone}"
}


data "aws_route53_zone" "default" {
  name = local.route_53_zone
}

module "ecs_common_data" {
  source = "./ecs-common-data"

  environment = var.environment
  namespace   = var.namespace
}

################################################################################
## Backstage ECS
################################################################################
module "backstage" {
  source                    = "sourcefuse/arc-backstage-ecs-app/aws"
  version                   = "0.2.2"
  alb_dns_name              = module.ecs_common_data.alb_dns_name
  alb_zone_id               = module.ecs_common_data.alb_dns_zone_id
  app_host_name             = var.app_host_name
  cluster_id                = module.ecs_common_data.ecs_cluster_id
  cluster_name              = module.ecs_common_data.ecs_cluster_name
  environment               = var.environment
  route_53_records          = [var.app_host_name]
  lb_listener_arn           = module.ecs_common_data.alb_https_listener_arn
  lb_security_group_ids     = [module.ecs_common_data.ecs_alb_sg]
  route_53_zone_name        = var.route_53_zone_name
  subnet_ids                = data.aws_subnets.private.ids
  vpc_id                    = data.aws_vpc.vpc.id
  container_image           = var.container_image
  tags                      = module.tags.tags
  task_definition_cpu       = 2048
  task_definition_memory    = 4096
  secret_name               = var.secret_name
  private_key_secret_name   = var.private_key_secret_name
  health_check_path_pattern = "/healthcheck"
}
