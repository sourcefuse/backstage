region             = "us-east-1"
environment        = "prod"
acm_domain_name    = "*.arc-prod.link"
route_53_zone_name = "arc-prod.link"
container_image    = "sourcefuse/sourcefuse-backstage:0.3.8" // just in case: "235465132804.dkr.ecr.us-east-1.amazonaws.com/sourcefuse-backstage:latest"
namespace          = "arc"
