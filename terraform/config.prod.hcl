region         = "us-east-1"
key            = "sourcefuse-backstage/terraform.tfstate"
bucket         = "sf-arc-prod-terraform-state-bucket"
dynamodb_table = "sf-arc-prod-terraform-state-lock-table"
encrypt        = true
