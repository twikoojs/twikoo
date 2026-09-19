variable "region" {
  description = "AWS region to deploy the function in."
  default     = "us-west-2"
}

variable "mongodb_uri" {
  description = "MongoDB connection URI. The value will be passed to the Lambda function as environment variable MONGODB_URI."
  sensitive   = true
}
