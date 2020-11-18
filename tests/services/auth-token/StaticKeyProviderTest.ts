/* eslint-disable no-unused-expressions */

import { describe, it } from 'mocha'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { StaticKeyProviderBuilder } from '../../../src/services/auth-token/key-provider/StaticKeyProviderBuilder'
import { VerificationCredentials } from '../../../src/services/auth-token/key-provider/IKeyProvider'

const assert = chai.assert

chai.use(chaiAsPromised)

describe('StaticKeyProvider', () => {
  it('getCredentials_WithEmptyList_Returns_Undefined', () => {
    const builder = new StaticKeyProviderBuilder()
    const sut = builder
      .withCredentials([])
      .build()

    const issuerId = ''
    const creds = sut.getCertificateForIssuer(issuerId)

    assert.isUndefined(creds, 'creds should be undefined.')
  })
  it('getCredentials_WithExisting_Returns_CorrectResult', () => {

      const issuerId = 'unit-test-issuer'
      const correct : VerificationCredentials = {
        id: issuerId,
        issuer: 'unit-test-issuer',
        algorithms: ['ES256', 'ES512', 'RS384'],
        certificate: 'unit-test-certificate'
      }

      const builder = new StaticKeyProviderBuilder()
      const sut = builder
        .withCredentials([correct])
        .build()

      const creds = sut.getCredentials(issuerId)

      assert.deepEqual(creds, correct, 'The result doesn\'t match expected value.')
  })
  it('getCredentials_WithNonExisting_Returns_Undefined', () => {

      const issuerId = 'unit-test-issuer'
      const correct : VerificationCredentials = {
        id: issuerId + '-incorrect',
        issuer: 'unit-test-issuer',
        algorithms: ['ES256', 'ES512', 'RS384'],
        certificate: 'unit-test-certificate'
      }

      const builder = new StaticKeyProviderBuilder()
      const sut = builder
        .withCredentials([correct])
        .build()

      const creds = sut.getCredentials(issuerId)

      assert.isUndefined(creds, 'creds should be undefined.')
  })
  it('getCredentials_WithMultiple_Returns_First', () => {
      const issuerId = 'unit-test-issuer'
      const correct : VerificationCredentials = {
        id: issuerId,
        issuer: 'unit-test-issuer',
        algorithms: ['ES256', 'ES512', 'RS384'],
        certificate: 'unit-test-certificate'
      }

      const incorrect : VerificationCredentials = {
        id: issuerId,
        issuer: 'unit-test-issuer-incorrect',
        algorithms: ['ES256'],
        certificate: 'unit-test-certificate-incorrect'
      }

      const builder = new StaticKeyProviderBuilder()
      const sut = builder
        .withCredentials([correct, incorrect])
        .build()

      const creds = sut.getCredentials(issuerId)

      assert.deepEqual(creds, correct, 'The result doesn\'t match expected value.')
  })
})
