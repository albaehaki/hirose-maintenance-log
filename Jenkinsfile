// Jenkinsfile — diletakkan di root repository
pipeline {
  agent any

  environment {
    DOCKER_COMPOSE = 'docker compose'
  }

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git log --oneline -10'
      }
    }

    stage('Install Dependencies') {
      parallel {
        stage('backend') {
          steps {
            dir('backend') { sh 'pnpm install --frozen-lockfile' }
          }
        }
        stage('frontend') {
          steps {
            dir('frontend') { sh 'pnpm install --frozen-lockfile' }
          }
        }
      }
    }

    stage('Lint & Typecheck') {
      steps {
        dir('backend')  { sh 'pnpm exec tsc --noEmit' }
        dir('frontend') { sh 'pnpm exec vue-tsc --noEmit' }
      }
    }

    stage('Build Frontend') {
      steps {
        dir('frontend') { sh 'pnpm build' }
      }
    }

    stage('Build Images') {
      steps {
        sh 'docker compose build'
      }
    }

    stage('Integration Test — Permission Matrix') {
      steps {
        sh '''
          cp .env.example .env
          docker compose up -d
          ./scripts/wait-for-healthy.sh
          # Dari dalam container api, web container diakses via service name
          docker compose exec -T -e TEST_BASE_URL=http://web:80/api api node --test dist/tests/permission-matrix.test.js
        '''
      }
      post {
        always {
          sh 'docker compose logs --no-color > compose-logs.txt || true'
          archiveArtifacts artifacts: 'compose-logs.txt', allowEmptyArchive: true
        }
      }
    }

    stage('Teardown') {
      steps {
        sh 'docker compose down -v || true'
      }
    }
  }

  post {
    always  { cleanWs() }
    failure { echo 'Pipeline gagal — lihat arsip compose-logs.txt untuk detail container.' }
    success { echo 'Semua stage lulus, termasuk matriks permission.' }
  }
}
