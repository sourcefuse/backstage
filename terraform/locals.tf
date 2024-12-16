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
    {
      name  = "SONARCLOUD_TOKEN"
      value = data.aws_ssm_parameter.sonarcloud_token.value
    },
    {
      name  = "JENKINS_BASEURL1"
      value = data.aws_ssm_parameter.jenkins_baseurl1.value
    },
    {
      name  = "JENKINS_USERNAME1"
      value = data.aws_ssm_parameter.jenkins_username1.value
    },
    {
      name  = "JENKINS_PROJECTCOUNTLIMIT1"
      value = data.aws_ssm_parameter.jenkins_projectcountlimit1.value
    },
    {
      name  = "JENKINS_API_TOKEN1"
      value = data.aws_ssm_parameter.jenkins_apitoken1.value
    },

  ]
}
