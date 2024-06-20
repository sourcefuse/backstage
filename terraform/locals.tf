locals {
  route_53_zone       = trimprefix(var.acm_domain_name, "*.")
  health_check_domain = "healthcheck-${var.namespace}-${var.environment}.${local.route_53_zone}"
  environment_variables = [
      {
        name  = "GITHUB_API_URL"
        value = "https://api.github.com"
      },
      {
        name  = "GITHUB_ORGANIZATION"
        value = "sourcefuse"
      },
      {
        name  = "REPO_CREATOR_TEAM"
        value = data.aws_ssm_parameter.repo_name.value
      },
  ]
}
