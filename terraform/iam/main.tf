################################################################################
## defaults
################################################################################
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      version = ">= 4.0"
      source  = "hashicorp/aws"
    }
  }

  backend "s3" {}
}

module "tags" {
  source  = "sourcefuse/arc-tags/aws"
  version = "1.2.3"

  environment = var.environment
  project     = var.project_name

  extra_tags = {
    Repo = "github.com/sourcefuse/backstage"
    Path = "terraform/iam"
  }
}

provider "aws" {
  region = var.region
}

################################################################################
## backend
################################################################################
data "aws_iam_policy_document" "backend" {
  version = "2012-10-17"

  ## backend state
  statement {
    effect = "Allow"
    actions = [
      "s3:ListBucket"
    ]
    resources = [
      "arn:${data.aws_partition.this.partition}:s3:::sf-${var.namespace}-${var.environment}-terraform-state-bucket"
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = [
      "arn:${data.aws_partition.this.partition}:s3:::sf-${var.namespace}-${var.environment}-terraform-state-bucket/env:/${var.environment}/sourcefuse-backstage/terraform.tfstate"
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem"
    ]
    resources = [
      "arn:${data.aws_partition.this.partition}:dynamodb:*:*:table/sf-${var.namespace}-${var.environment}-terraform-state-lock-table"
    ]
  }
}

resource "aws_iam_policy" "backend" {
  name        = "${var.namespace}-${var.environment}-backend-access"
  path        = "/"
  description = "Backend access policy"

  policy = data.aws_iam_policy_document.backend.json
}

resource "aws_iam_role_policy_attachment" "this" {
  for_each = { for x in local.service_roles : x.role_name => x }

  role       = each.value.role_name
  policy_arn = aws_iam_policy.backend.arn

  depends_on = [
    aws_iam_role.github_oidc
  ]
}

################################################################################
## openid connect
################################################################################
resource "aws_iam_openid_connect_provider" "github_oidc" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd" # Refer to: https://github.blog/changelog/2023-06-27-github-actions-update-on-oidc-integration-with-aws/
  ]

  tags = module.tags.tags
}

################################################################################
## role
################################################################################
resource "aws_iam_role" "github_oidc" {
  for_each = { for x in local.service_roles : x.role_name => x }

  name                 = each.value.role_name
  max_session_duration = each.value.max_session_duration

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity",
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_oidc.arn
        }
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org_name}/${each.value.repo_name}:${each.value.ref}"
          },
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      },
    ]
  })

  tags = merge(module.tags.tags, tomap({
    Name = each.value.role_name
  }))
}

resource "aws_iam_policy" "github_oidc" {
  for_each = { for x in local.service_roles : x.role_name => x }

  name   = each.value.role_name
  policy = jsonencode(each.value.policy)

  depends_on = [
    aws_iam_role.github_oidc
  ]
}

resource "aws_iam_role_policy_attachment" "github_oidc" {
  for_each = { for x in local.service_roles : x.role_name => x }

  policy_arn = aws_iam_policy.github_oidc[each.value.role_name].arn
  role       = aws_iam_role.github_oidc[each.value.role_name].id
}
