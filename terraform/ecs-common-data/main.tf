//TODO: invert this dependency so the top level module passes in the common data?     // NOSONAR
################################################################
## defaults
################################################################
terraform {
  required_version = "~> 1.4"

  required_providers {
    aws = {
      version = "~> 4.0"
      source  = "hashicorp/aws"
    }
  }
}
###############################################
## imports
################################################
## network
data "aws_vpc" "vpc" {
  filter {
    name   = "tag:Name"
    values = ["${var.namespace}-${var.environment}-vpc"]
  }
}

## network
data "aws_subnets" "public" {
  filter {
    name = "tag:Name"
    values = [
      "${var.namespace}-${var.environment}-public-subnet-public-${var.region}a",
      "${var.namespace}-${var.environment}-public-subnet-public-${var.region}b"
    ]
  }
}

data "aws_subnets" "private" {
  filter {
    name = "tag:Name"
    values = [
      "${var.namespace}-${var.environment}-private-subnet-private-${var.region}a",
      "${var.namespace}-${var.environment}-private-subnet-private-${var.region}b"
    ]
  }
}

//TODO: replace SSM lookups with data lookup after standardizing    // NOSONAR
data "aws_ssm_parameter" "alb_https_listener_arn" {
  name = "/${var.namespace}/${var.environment}/alb/${var.namespace}-${var.environment}-cluster/https-listener/arn"
}

data "aws_ssm_parameter" "alb_dns_name" {
  name = "/${var.namespace}/${var.environment}/alb/${var.namespace}-${var.environment}-cluster/endpoint"
}

data "aws_ssm_parameter" "alb_dns_zone_id" {
  name = "/${var.namespace}/${var.environment}/alb/${var.namespace}-${var.environment}-cluster/dns_zone_id"
}

data "aws_ssm_parameter" "ecs_cluster_id" {
  name = "/${var.namespace}/${var.environment}/ecs/${var.namespace}-${var.environment}-cluster/id"
}

data "aws_ecs_cluster" "ecs_cluster" {
  cluster_name = "${var.namespace}-${var.environment}-cluster"
}

data "aws_security_group" "ecs_alb_sg" {
  filter {
    name = "tag:Name"
    values = [
      "${var.namespace}-${var.environment}-cluster-alb"
    ]
  }
}
