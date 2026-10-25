output "api_url" {
  description = "Public URL of the API (allow a few minutes after apply for first boot)."
  value       = "http://${aws_instance.api.public_dns}"
}

output "instance_id" {
  description = "EC2 instance running the API container."
  value       = aws_instance.api.id
}

output "ssm_session_command" {
  description = "Open a shell on the instance without SSH."
  value       = "aws ssm start-session --region ${var.aws_region} --target ${aws_instance.api.id}"
}

output "db_endpoint" {
  description = "RDS Postgres endpoint (private, reachable only from the API host)."
  value       = aws_db_instance.main.endpoint
}

output "db_secret_arn" {
  description = "Secrets Manager ARN holding the generated database credentials."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "log_group" {
  description = "CloudWatch log group with API container logs."
  value       = aws_cloudwatch_log_group.api.name
}
