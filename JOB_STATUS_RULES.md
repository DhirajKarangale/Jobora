# 📋 Job Status Business Rules

This document outlines the core business rules for determining the status of a job in the **Jobora** system based on database fields and Redis state.

## 🤖 AI Processing Status

| Status | Condition | Description |
| :--- | :--- | :--- |
| **Pending AI Check** | Present in `Redis Stream` | Jobs currently in the Redis stream waiting to be processed by the workers. <br/>*(Refer to `getConsumerGroupInfo()` in [`clean_redis_stream.ts`](./backend/src/cloud/redis/clean_redis_stream.ts))* |
| **Not Checked by AI** | `is_eligible IS NULL` | Jobs present in the database that have not yet been evaluated by the AI. |
| **Checked by AI** | `is_eligible IS NOT NULL` | Jobs that have been evaluated (where `is_eligible` is explicitly `true` or `false`). |

## 🎯 Eligibility Status

| Status | Condition | Description |
| :--- | :--- | :--- |
| **Eligible / Open to Apply** | `is_eligible = true` | The AI has determined this job is a good fit and it is open for application. |
| **Not Eligible** | `is_eligible = false` | The AI has determined this job is not a fit. |

## 📅 Application & Expiration Status

| Status | Condition | Description |
| :--- | :--- | :--- |
| **Job Applied** | `applied_date IS NOT NULL` | We have successfully applied to this job (a valid applied date exists). |
| **Job Expired** | `is_expired = true` | The job listing is no longer active or available on the portal. |
| **Job Not Expired** | `is_expired = false` OR `IS NULL` | The job listing is still considered active. |
