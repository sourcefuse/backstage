################################################################################
## network
################################################################################
output "vpc_id" {
  description = "ID of the VPC"
  value       = data.aws_vpc.vpc.id
}

output "vpc_name" {
  description = "Name of the VPC"
  value       = data.aws_vpc.vpc.tags["Name"]
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = data.aws_vpc.vpc.cidr_block
}


output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = data.aws_subnets.private.ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = data.aws_subnets.public.ids
}

output "alb_https_listener_arn" {
  description = "HTTPS Listener ARN to bind target groups to"
  value       = data.aws_ssm_parameter.alb_https_listener_arn.value
}

output "alb_dns_name" {
  description = "ALB DNS Name"
  value       = data.aws_ssm_parameter.alb_dns_name.value
}

output "alb_dns_zone_id" {
  description = "ALB DNS ZoneID"
  value       = data.aws_ssm_parameter.alb_dns_zone_id.value
}

output "ecs_cluster_id" {
  description = "ECS Cluster ID"
  value       = data.aws_ssm_parameter.ecs_cluster_id.value
}

output "ecs_cluster_name" {
  description = "ECS Cluster Name"
  value       = data.aws_ecs_cluster.ecs_cluster.cluster_name
}

output "ecs_alb_sg" {
  description = "ALB SG to allow only traffic from the ALB"
  value       = data.aws_security_group.ecs_alb_sg.id
}
