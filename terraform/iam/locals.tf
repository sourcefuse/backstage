locals {
  service_roles = [
    {
      role_name            = "${var.namespace}-${var.environment}-terraform-backstage-deploy"
      max_session_duration = 7200
      repo_name            = "backstage"
      ref                  = "*"
      policy = {
        "Version" : "2012-10-17",
        "Statement" : [
          {
            "Action" : [
              "*"
            ],
            "Effect" : "Allow",
            "Resource" : ["*"]
          }
        ]
      }
    },
  ]
}
