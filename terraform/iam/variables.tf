################################################################
## shared
################################################################
variable "project_name" {
  type        = string
  description = "Name of the project."
  default     = "backstage"
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "environment" {
  type        = string
  description = "ID element. Usually used for region e.g. 'uw2', 'us-west-2', OR role 'prod', 'staging', 'dev', 'UAT'"
}

variable "namespace" {
  type        = string
  description = "Namespace for the resources."
  default     = "arc"
}

################################################################################
## github
################################################################################
variable "github_org_name" {
  type        = string
  description = "GitHub Organization name"
  default     = "sourcefuse"
}

variable "service_roles" {
  type = list(object({
    role_name            = string
    max_session_duration = optional(number, 3600)
    repo_name            = string
    ref                  = optional(string, "*")
    # `*` allows any branch, pull request merge branch, or environment to assume role
    policy = any
  }))
  description = <<-EOT
    Service Roles that will be used for the repos to access AWS resources.
    If `repo_name` is set to "*" all repos in the GitHub Organization will be included.
    `ref` is optional, the default being "*" which allows any branch, pull request merge branch, or environment to assume role
  EOT
  default     = []
}
