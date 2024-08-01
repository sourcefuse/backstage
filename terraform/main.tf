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
  project     = var.namespace

  extra_tags = {
    MonoRepo = "False"
  }
}

################################################################################
## locals
################################################################################
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
  version                   = "0.2.8"
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
  subnet_ids                = module.ecs_common_data.private_subnet_ids
  vpc_id                    = module.ecs_common_data.vpc_id
  container_image           = var.container_image_override == null ? one(data.aws_ssm_parameter.container_image[*].value) : var.container_image_override
  tags                      = module.tags.tags
  task_definition_cpu       = 2048
  task_definition_memory    = 4096
  secret_name               = var.secret_name
  private_key_secret_name   = var.private_key_secret_name
  health_check_path_pattern = "/healthcheck"
  desired_count             = 2
  environment_variables     = local.environment_variables
  ephemeral_storage         = var.ephemeral_storage
}
