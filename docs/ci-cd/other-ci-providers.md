# Other CI providers

Diffra's zero-dependency CLI (`@diffra/cli`) runs on any standard continuous integration environment including GitLab CI, CircleCI, Bitbucket Pipelines, and Jenkins.

---

## 1. GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test

visual-regression:
  stage: test
  image: node:22-bookworm
  before_script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm exec playwright install --with-deps chromium
  script:
    - pnpm build-storybook
    - pnpm diffra test --url http://localhost:6006
  artifacts:
    when: always
    paths:
      - .diffra/
    expire_in: 14 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## 2. CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1

executors:
  node-executor:
    docker:
      - image: cimg/node:22.0.0-browsers

jobs:
  visual-tests:
    executor: node-executor
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: pnpm install --frozen-lockfile
      - run:
          name: Build Storybook
          command: pnpm build-storybook
      - run:
          name: Run Diffra tests
          command: pnpm diffra test --pass-on-changes
      - store_artifacts:
          path: .diffra
          destination: visual-report

workflows:
  build-test:
    jobs:
      - visual-tests
```

---

## 3. Bitbucket Pipelines

Create `bitbucket-pipelines.yml`:

```yaml
image: node:22-bookworm

pipelines:
  pull-requests:
    '**':
      - step:
          name: Visual Regression Tests
          caches:
            - node
          script:
            - npm ci
            - npx playwright install --with-deps chromium
            - npm run build-storybook
            - npx diffra test
          artifacts:
            - .diffra/**
```
