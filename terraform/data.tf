data "aws_ssm_parameter" "container_image" {
  count = var.container_image_override == null ? 1 : 0
  name  = "/${var.environment}/backstage/container-image"
}

data "aws_route53_zone" "default" {
  name = local.route_53_zone
}

## network
data "aws_vpc" "vpc" {
  filter {
    name   = "tag:Name"
    values = ["${var.namespace}-${var.environment}-vpc"]
  }
}

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

# Define data sources for SSM parameters
data "aws_ssm_parameter" "repo_name" {
  name = "/backstage/${var.environment}/repo/creator/name"
}

data "aws_ssm_parameter" "sonarcloud_token" {
  name = "/backstage/${var.environment}/sonarcloud/token"
}
data "aws_ssm_parameter" "jenkins_baseurl1" {
  name = "/backstage/${var.environment}/jenkins/baseurl1"
}
data "aws_ssm_parameter" "jenkins_username1" {
  name = "/backstage/${var.environment}/jenkins/username1"
}

data "aws_ssm_parameter" "jenkins_projectcountlimit1" {
  name = "/backstage/${var.environment}/jenkins/projectcountlimit1"
}

data "aws_ssm_parameter" "jenkins_apitoken1" {
  name = "/backstage/${var.environment}/jenkins/apitoken1"
}
