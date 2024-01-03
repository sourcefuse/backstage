################################################################################
## shared
################################################################################
variable "namespace" {
  type        = string
  description = "Namespace for the resources."
}

variable "environment" {
  type        = string
  default     = "poc"
  description = "ID element. Usually used for region e.g. 'uw2', 'us-west-2', OR role 'prod', 'staging', 'dev', 'UAT'"
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

################################################################################
## route 53
################################################################################
variable "route_53_profile_name" {
  type        = string
  description = "Profile where the Route 53 Zone lives."
  default     = "poc2"
}

################################################################################
## acm
################################################################################
variable "create_acm_certificate" {
  type        = bool
  description = "Create an ACM Certificate to use with the ALB"
  default     = true
}

variable "acm_domain_name" {
  type        = string
  description = "Domain name the ACM Certificate belongs to"
  default     = "*.arc-poc.link"
}

################################################################################
## alb
################################################################################
variable "alb_internal" {
  type        = bool
  description = "Determines if this load balancer is internally or externally facing."
  default     = false
}

variable "alb_certificate_arn" {
  type        = string
  description = "ALB Certificate ARN. If `var.create_acm_certificate` is `true`, this will be ignored."
  default     = null
}

################################################################################
## task execution
################################################################################
variable "execution_policy_attachment_arns" {
  type        = list(string)
  description = "The ARNs of the policies you want to apply"
  default = [
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  ]
}

variable "app_host_name" {
  type        = string
  description = "Host name to expose via Route53"
  default     = "dx.arc-poc.link"
}

variable "container_image" {
  type        = string
  description = "url for image being used to setup backstage"
  default     = "spotify/backstage-cookiecutter"

}

variable "secret_name" {
  type        = string
  description = "Name of the secret in AWS Secrets Manager that contains Backstage secrets, such as POSTGRES_USER and POSTGRES_PASSWORD"
  default     = "arc/poc/sf-arc-poc2-backstage"
}

variable "private_key_secret_name" {
  type        = string
  description = "Name of the secret in AWS Secrets Manager that contains Backstage private key for GitHub authentication. The secret should be stored as plain text in ASM."
  default     = "arc/poc/sf-arc-poc2-backstage-private-key"
}

variable "route_53_zone_name" {
  type        = string
  description = "Route53 zone name used for looking up and creating an `A` record for the health check service"
  default     = "arc-poc.link"
}

variable "desired_count" {
  type        = number
  description = "Number of ECS tasks to run for the health check."
  default     = 1
}

variable "deploy_backstage" {
  type        = bool
  description = "Deploy the Backstage image to the cluster."
  default     = true
}

variable "acm_process_domain_validation_options" {
  type        = bool
  description = "Flag to enable/disable processing of the record to add to the DNS zone to complete certificate validation"
  default     = false
}

################################################################################
## health check
################################################################################
variable "route_53_private_zone" {
  type        = bool
  description = "Used with `name` field to get a private Hosted Zone"
  default     = false
}
