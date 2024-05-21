variable "region" {
  description = "AWS region to deploy the function in."
  default     = "us-west-2"
}

variable "mongodb_uri" {
  description = "MongoDB connection URI"
  sensitive   = true
}
