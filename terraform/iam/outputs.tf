################################################################################
## Service Roles
################################################################################
output "service_role_arns" {
  description = "The ARNs of the IAM roles created by the aws_iam_role.github_oidc resource block."
  value       = [for role in aws_iam_role.github_oidc : role.arn]
}

output "service_role_ids" {
  description = "The IDs of the IAM roles created by the aws_iam_role.github_oidc resource block."
  value       = [for role in aws_iam_role.github_oidc : role.id]
}

output "service_role_names" {
  description = "The names of the IAM roles created by the aws_iam_role.github_oidc resource block."
  value       = [for role in aws_iam_role.github_oidc : role.name]
}
