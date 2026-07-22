from workflow import manage_job_workflow


def main():
    job_id_phonepe_backend = "77e0fda6-baaa-4963-adec-46a12755c63e"
    job_id_eton_csharp = "04cfca07-f5c0-49c6-8f41-f033646a94c4"
    job_id_hackjob_java = "4c847b0a-5e98-4e14-bf80-d4e507afa844"
    job_id_eqnix_generic = "4c847b0a-5e98-4e14-bf80-d4e507afa844"
    manage_job_workflow(job_id_phonepe_backend)


if __name__ == "__main__":
    main()
