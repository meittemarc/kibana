/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React from 'react';
import * as reactTestingLibrary from '@testing-library/react';

import { HostList } from './index';
import {
  mockHostDetailsApiResult,
  mockHostResultList,
  setHostListApiMockImplementation,
} from '../store/mock_host_result_list';
import { AppContextTestRender, createAppRootMockRenderer } from '../../../../common/mock/endpoint';
import {
  HostInfo,
  HostPolicyResponse,
  HostPolicyResponseActionStatus,
  HostPolicyResponseAppliedAction,
  HostStatus,
} from '../../../../../common/endpoint/types';
import { EndpointDocGenerator } from '../../../../../common/endpoint/generate_data';
import { POLICY_STATUS_TO_HEALTH_COLOR, POLICY_STATUS_TO_TEXT } from './host_constants';
import { mockPolicyResultList } from '../../policy/store/policy_list/test_mock_utils';

jest.mock('../../../../common/components/link_to');

describe('when on the hosts page', () => {
  const docGenerator = new EndpointDocGenerator();
  let render: () => ReturnType<AppContextTestRender['render']>;
  let history: AppContextTestRender['history'];
  let store: AppContextTestRender['store'];
  let coreStart: AppContextTestRender['coreStart'];
  let middlewareSpy: AppContextTestRender['middlewareSpy'];

  beforeEach(() => {
    const mockedContext = createAppRootMockRenderer();
    ({ history, store, coreStart, middlewareSpy } = mockedContext);
    render = () => mockedContext.render(<HostList />);
    reactTestingLibrary.act(() => {
      history.push('/hosts');
    });
  });

  it('should NOT display timeline', async () => {
    const renderResult = render();
    const timelineFlyout = await renderResult.queryByTestId('flyoutOverlay');
    expect(timelineFlyout).toBeNull();
  });

  describe('when there are no hosts or polices', () => {
    beforeEach(() => {
      setHostListApiMockImplementation(coreStart.http, {
        hostsResults: [],
      });
    });

    it('should show the empty state when there are no hosts or polices', async () => {
      const renderResult = render();
      await reactTestingLibrary.act(async () => {
        await middlewareSpy.waitForAction('serverReturnedPoliciesForOnboarding');
      });
      // Initially, there are no hosts or policies, so we prompt to add policies first.
      const table = await renderResult.findByTestId('emptyPolicyTable');
      expect(table).not.toBeNull();
    });
  });

  describe('when there are policies, but no hosts', () => {
    beforeEach(async () => {
      setHostListApiMockImplementation(coreStart.http, {
        hostsResults: [],
        endpointPackageConfigs: mockPolicyResultList({ total: 3 }).items,
      });
    });
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should show the no hosts empty state', async () => {
      const renderResult = render();
      await reactTestingLibrary.act(async () => {
        await middlewareSpy.waitForAction('serverReturnedPoliciesForOnboarding');
      });
      const emptyHostsTable = await renderResult.findByTestId('emptyHostsTable');
      expect(emptyHostsTable).not.toBeNull();
    });

    it('should display the onboarding steps', async () => {
      const renderResult = render();
      await reactTestingLibrary.act(async () => {
        await middlewareSpy.waitForAction('serverReturnedPoliciesForOnboarding');
      });
      const onboardingSteps = await renderResult.findByTestId('onboardingSteps');
      expect(onboardingSteps).not.toBeNull();
    });

    it('should show policy selection', async () => {
      const renderResult = render();
      await reactTestingLibrary.act(async () => {
        await middlewareSpy.waitForAction('serverReturnedPoliciesForOnboarding');
      });
      const onboardingPolicySelect = await renderResult.findByTestId('onboardingPolicySelect');
      expect(onboardingPolicySelect).not.toBeNull();
    });
  });

  describe('when there is no selected host in the url', () => {
    it('should not show the flyout', () => {
      const renderResult = render();
      expect.assertions(1);
      return renderResult.findByTestId('hostDetailsFlyout').catch((e) => {
        expect(e).not.toBeNull();
      });
    });
    describe('when list data loads', () => {
      const generatedPolicyStatuses: Array<
        HostInfo['metadata']['Endpoint']['policy']['applied']['status']
      > = [];
      let firstPolicyID: string;
      beforeEach(() => {
        reactTestingLibrary.act(() => {
          const hostListData = mockHostResultList({ total: 4 }).hosts;

          firstPolicyID = hostListData[0].metadata.Endpoint.policy.applied.id;

          [HostStatus.ERROR, HostStatus.ONLINE, HostStatus.OFFLINE, HostStatus.UNENROLLING].forEach(
            (status, index) => {
              hostListData[index] = {
                metadata: hostListData[index].metadata,
                host_status: status,
              };
            }
          );
          hostListData.forEach((item, index) => {
            generatedPolicyStatuses[index] = item.metadata.Endpoint.policy.applied.status;
          });

          // Make sure that the first policy id in the host result is not set as non-existent
          const ingestPackageConfigs = mockPolicyResultList({ total: 1 }).items;
          ingestPackageConfigs[0].id = firstPolicyID;

          setHostListApiMockImplementation(coreStart.http, {
            hostsResults: hostListData,
            endpointPackageConfigs: ingestPackageConfigs,
          });
        });
      });

      it('should display rows in the table', async () => {
        const renderResult = render();
        await reactTestingLibrary.act(async () => {
          await middlewareSpy.waitForAction('serverReturnedHostList');
        });
        const rows = await renderResult.findAllByRole('row');
        expect(rows).toHaveLength(5);
      });
      it('should show total', async () => {
        const renderResult = render();
        await reactTestingLibrary.act(async () => {
          await middlewareSpy.waitForAction('serverReturnedHostList');
        });
        const total = await renderResult.findByTestId('hostListTableTotal');
        expect(total.textContent).toEqual('4 Hosts');
      });
      it('should display correct status', async () => {
        const renderResult = render();
        await reactTestingLibrary.act(async () => {
          await middlewareSpy.waitForAction('serverReturnedHostList');
        });
        const hostStatuses = await renderResult.findAllByTestId('rowHostStatus');

        expect(hostStatuses[0].textContent).toEqual('Error');
        expect(hostStatuses[0].querySelector('[data-euiicon-type][color="danger"]')).not.toBeNull();

        expect(hostStatuses[1].textContent).toEqual('Online');
        expect(
          hostStatuses[1].querySelector('[data-euiicon-type][color="success"]')
        ).not.toBeNull();

        expect(hostStatuses[2].textContent).toEqual('Offline');
        expect(
          hostStatuses[2].querySelector('[data-euiicon-type][color="subdued"]')
        ).not.toBeNull();

        expect(hostStatuses[3].textContent).toEqual('Unenrolling');
        expect(
          hostStatuses[3].querySelector('[data-euiicon-type][color="warning"]')
        ).not.toBeNull();
      });

      it('should display correct policy status', async () => {
        const renderResult = render();
        await reactTestingLibrary.act(async () => {
          await middlewareSpy.waitForAction('serverReturnedHostList');
        });
        const policyStatuses = await renderResult.findAllByTestId('rowPolicyStatus');

        policyStatuses.forEach((status, index) => {
          expect(status.textContent).toEqual(POLICY_STATUS_TO_TEXT[generatedPolicyStatuses[index]]);
          expect(
            status.querySelector(
              `[data-euiicon-type][color=${
                POLICY_STATUS_TO_HEALTH_COLOR[generatedPolicyStatuses[index]]
              }]`
            )
          ).not.toBeNull();
        });
      });

      it('should display policy name as a link', async () => {
        const renderResult = render();
        await reactTestingLibrary.act(async () => {
          await middlewareSpy.waitForAction('serverReturnedHostList');
        });
        const firstPolicyName = (await renderResult.findAllByTestId('policyNameCellLink'))[0];
        expect(firstPolicyName).not.toBeNull();
        expect(firstPolicyName.getAttribute('href')).toContain(`policy/${firstPolicyID}`);
      });

      describe('when the user clicks the first hostname in the table', () => {
        let renderResult: reactTestingLibrary.RenderResult;
        beforeEach(async () => {
          renderResult = render();
          await reactTestingLibrary.act(async () => {
            await middlewareSpy.waitForAction('serverReturnedHostList');
          });
          const hostNameLinks = await renderResult.findAllByTestId('hostnameCellLink');
          if (hostNameLinks.length) {
            reactTestingLibrary.fireEvent.click(hostNameLinks[0]);
          }
        });

        it('should show the flyout', () => {
          return renderResult.findByTestId('hostDetailsFlyout').then((flyout) => {
            expect(flyout).not.toBeNull();
          });
        });
      });
    });
  });

  describe('when there is a selected host in the url', () => {
    let hostDetails: HostInfo;
    let agentId: string;
    let renderAndWaitForData: () => Promise<ReturnType<AppContextTestRender['render']>>;

    const createPolicyResponse = (
      overallStatus: HostPolicyResponseActionStatus = HostPolicyResponseActionStatus.success
    ): HostPolicyResponse => {
      const policyResponse = docGenerator.generatePolicyResponse();
      const malwareResponseConfigurations =
        policyResponse.Endpoint.policy.applied.response.configurations.malware;
      policyResponse.Endpoint.policy.applied.status = overallStatus;
      malwareResponseConfigurations.status = overallStatus;
      let downloadModelAction = policyResponse.Endpoint.policy.applied.actions.find(
        (action) => action.name === 'download_model'
      );

      if (!downloadModelAction) {
        downloadModelAction = {
          name: 'download_model',
          message: 'Failed to apply a portion of the configuration (kernel)',
          status: overallStatus,
        };
        policyResponse.Endpoint.policy.applied.actions.push(downloadModelAction);
      } else {
        // Else, make sure the status of the generated action matches what was passed in
        downloadModelAction.status = overallStatus;
      }

      if (
        overallStatus === HostPolicyResponseActionStatus.failure ||
        overallStatus === HostPolicyResponseActionStatus.warning
      ) {
        downloadModelAction.message = 'no action taken';
      }

      // Make sure that at least one configuration has the above action, else
      // we get into an out-of-sync condition
      if (
        malwareResponseConfigurations.concerned_actions.indexOf(downloadModelAction.name) === -1
      ) {
        malwareResponseConfigurations.concerned_actions.push(downloadModelAction.name);
      }

      // Add an unknown Action Name - to ensure we handle the format of it on the UI
      const unknownAction: HostPolicyResponseAppliedAction = {
        status: HostPolicyResponseActionStatus.success,
        message: 'test message',
        name: 'a_new_unknown_action',
      };
      policyResponse.Endpoint.policy.applied.actions.push(unknownAction);
      malwareResponseConfigurations.concerned_actions.push(unknownAction.name);

      return policyResponse;
    };

    const dispatchServerReturnedHostPolicyResponse = (
      overallStatus: HostPolicyResponseActionStatus = HostPolicyResponseActionStatus.success
    ) => {
      reactTestingLibrary.act(() => {
        store.dispatch({
          type: 'serverReturnedHostPolicyResponse',
          payload: {
            policy_response: createPolicyResponse(overallStatus),
          },
        });
      });
    };

    beforeEach(async () => {
      const {
        host_status,
        metadata: { host, ...details },
      } = mockHostDetailsApiResult();

      hostDetails = {
        host_status,
        metadata: {
          ...details,
          host: {
            ...host,
            id: '1',
          },
        },
      };

      agentId = hostDetails.metadata.elastic.agent.id;

      const policy = docGenerator.generatePolicyPackageConfig();
      policy.id = hostDetails.metadata.Endpoint.policy.applied.id;

      setHostListApiMockImplementation(coreStart.http, {
        hostsResults: [hostDetails],
        endpointPackageConfigs: [policy],
      });

      reactTestingLibrary.act(() => {
        history.push('/hosts?selected_host=1');
      });

      renderAndWaitForData = async () => {
        const renderResult = render();
        await middlewareSpy.waitForAction('serverReturnedHostDetails');
        return renderResult;
      };
    });
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should show the flyout', async () => {
      const renderResult = await renderAndWaitForData();
      return renderResult.findByTestId('hostDetailsFlyout').then((flyout) => {
        expect(flyout).not.toBeNull();
      });
    });

    it('should display policy name value as a link', async () => {
      const renderResult = await renderAndWaitForData();
      const policyDetailsLink = await renderResult.findByTestId('policyDetailsValue');
      expect(policyDetailsLink).not.toBeNull();
      expect(policyDetailsLink.getAttribute('href')).toEqual(
        `/policy/${hostDetails.metadata.Endpoint.policy.applied.id}`
      );
    });

    it('should update the URL when policy name link is clicked', async () => {
      const renderResult = await renderAndWaitForData();
      const policyDetailsLink = await renderResult.findByTestId('policyDetailsValue');
      const userChangedUrlChecker = middlewareSpy.waitForAction('userChangedUrl');
      reactTestingLibrary.act(() => {
        reactTestingLibrary.fireEvent.click(policyDetailsLink);
      });
      const changedUrlAction = await userChangedUrlChecker;
      expect(changedUrlAction.payload.pathname).toEqual(
        `/policy/${hostDetails.metadata.Endpoint.policy.applied.id}`
      );
    });

    it('should display policy status value as a link', async () => {
      const renderResult = await renderAndWaitForData();
      const policyStatusLink = await renderResult.findByTestId('policyStatusValue');
      expect(policyStatusLink).not.toBeNull();
      expect(policyStatusLink.getAttribute('href')).toEqual(
        '/hosts?page_index=0&page_size=10&selected_host=1&show=policy_response'
      );
    });

    it('should update the URL when policy status link is clicked', async () => {
      const renderResult = await renderAndWaitForData();
      const policyStatusLink = await renderResult.findByTestId('policyStatusValue');
      const userChangedUrlChecker = middlewareSpy.waitForAction('userChangedUrl');
      reactTestingLibrary.act(() => {
        reactTestingLibrary.fireEvent.click(policyStatusLink);
      });
      const changedUrlAction = await userChangedUrlChecker;
      expect(changedUrlAction.payload.search).toEqual(
        '?page_index=0&page_size=10&selected_host=1&show=policy_response'
      );
    });

    it('should display Success overall policy status', async () => {
      const renderResult = await renderAndWaitForData();
      reactTestingLibrary.act(() => {
        dispatchServerReturnedHostPolicyResponse(HostPolicyResponseActionStatus.success);
      });
      const policyStatusLink = await renderResult.findByTestId('policyStatusValue');
      expect(policyStatusLink.textContent).toEqual('Success');

      const policyStatusHealth = await renderResult.findByTestId('policyStatusHealth');
      expect(
        policyStatusHealth.querySelector('[data-euiicon-type][color="success"]')
      ).not.toBeNull();
    });

    it('should display Warning overall policy status', async () => {
      const renderResult = await renderAndWaitForData();
      reactTestingLibrary.act(() => {
        dispatchServerReturnedHostPolicyResponse(HostPolicyResponseActionStatus.warning);
      });
      const policyStatusLink = await renderResult.findByTestId('policyStatusValue');
      expect(policyStatusLink.textContent).toEqual('Warning');

      const policyStatusHealth = await renderResult.findByTestId('policyStatusHealth');
      expect(
        policyStatusHealth.querySelector('[data-euiicon-type][color="warning"]')
      ).not.toBeNull();
    });

    it('should display Failed overall policy status', async () => {
      const renderResult = await renderAndWaitForData();
      reactTestingLibrary.act(() => {
        dispatchServerReturnedHostPolicyResponse(HostPolicyResponseActionStatus.failure);
      });
      const policyStatusLink = await renderResult.findByTestId('policyStatusValue');
      expect(policyStatusLink.textContent).toEqual('Failed');

      const policyStatusHealth = await renderResult.findByTestId('policyStatusHealth');
      expect(
        policyStatusHealth.querySelector('[data-euiicon-type][color="danger"]')
      ).not.toBeNull();
    });

    it('should display Unknown overall policy status', async () => {
      const renderResult = await renderAndWaitForData();
      reactTestingLibrary.act(() => {
        dispatchServerReturnedHostPolicyResponse('' as HostPolicyResponseActionStatus);
      });
      const policyStatusLink = await renderResult.findByTestId('policyStatusValue');
      expect(policyStatusLink.textContent).toEqual('Unknown');

      const policyStatusHealth = await renderResult.findByTestId('policyStatusHealth');
      expect(
        policyStatusHealth.querySelector('[data-euiicon-type][color="subdued"]')
      ).not.toBeNull();
    });

    it('should include the link to reassignment in Ingest', async () => {
      coreStart.application.getUrlForApp.mockReturnValue('/app/ingestManager');
      const renderResult = await renderAndWaitForData();
      const linkToReassign = await renderResult.findByTestId('hostDetailsLinkToIngest');
      expect(linkToReassign).not.toBeNull();
      expect(linkToReassign.textContent).toEqual('Reassign Configuration');
      expect(linkToReassign.getAttribute('href')).toEqual(
        `/app/ingestManager#/fleet/agents/${agentId}/activity?openReassignFlyout=true`
      );
    });

    describe('when link to reassignment in Ingest is clicked', () => {
      beforeEach(async () => {
        coreStart.application.getUrlForApp.mockReturnValue('/app/ingestManager');
        const renderResult = await renderAndWaitForData();
        const linkToReassign = await renderResult.findByTestId('hostDetailsLinkToIngest');
        reactTestingLibrary.act(() => {
          reactTestingLibrary.fireEvent.click(linkToReassign);
        });
      });

      it('should navigate to Ingest without full page refresh', () => {
        expect(coreStart.application.navigateToApp.mock.calls).toHaveLength(1);
      });
    });

    describe('when showing host Policy Response panel', () => {
      let renderResult: ReturnType<typeof render>;
      beforeEach(async () => {
        coreStart.http.post.mockImplementation(async (requestOptions) => {
          if (requestOptions.path === '/api/endpoint/metadata') {
            return mockHostResultList({ total: 0 });
          }
          throw new Error(`POST to '${requestOptions.path}' does not have a mock response!`);
        });
        renderResult = await renderAndWaitForData();
        const policyStatusLink = await renderResult.findByTestId('policyStatusValue');
        const userChangedUrlChecker = middlewareSpy.waitForAction('userChangedUrl');
        reactTestingLibrary.act(() => {
          reactTestingLibrary.fireEvent.click(policyStatusLink);
        });
        await userChangedUrlChecker;
        await middlewareSpy.waitForAction('serverReturnedHostPolicyResponse');
        reactTestingLibrary.act(() => {
          dispatchServerReturnedHostPolicyResponse();
        });
      });

      afterEach(reactTestingLibrary.cleanup);

      it('should hide the host details panel', async () => {
        const hostDetailsFlyout = await renderResult.queryByTestId('hostDetailsFlyoutBody');
        expect(hostDetailsFlyout).toBeNull();
      });

      it('should display policy response sub-panel', async () => {
        expect(
          await renderResult.findByTestId('hostDetailsPolicyResponseFlyoutHeader')
        ).not.toBeNull();
        expect(
          await renderResult.findByTestId('hostDetailsPolicyResponseFlyoutBody')
        ).not.toBeNull();
      });

      it('should include the sub-panel title', async () => {
        expect(
          (await renderResult.findByTestId('hostDetailsPolicyResponseFlyoutTitle')).textContent
        ).toBe('Configuration Response');
      });

      it('should show a configuration section for each protection', async () => {
        const configAccordions = await renderResult.findAllByTestId(
          'hostDetailsPolicyResponseConfigAccordion'
        );
        expect(configAccordions).not.toBeNull();
      });

      it('should show an actions section for each configuration', async () => {
        const actionAccordions = await renderResult.findAllByTestId(
          'hostDetailsPolicyResponseActionsAccordion'
        );
        const action = await renderResult.findAllByTestId('policyResponseAction');
        const statusHealth = await renderResult.findAllByTestId('policyResponseStatusHealth');
        const message = await renderResult.findAllByTestId('policyResponseMessage');
        expect(actionAccordions).not.toBeNull();
        expect(action).not.toBeNull();
        expect(statusHealth).not.toBeNull();
        expect(message).not.toBeNull();
      });

      it('should not show any numbered badges if all actions are successful', () => {
        const policyResponse = docGenerator.generatePolicyResponse(
          new Date().getTime(),
          HostPolicyResponseActionStatus.success
        );
        reactTestingLibrary.act(() => {
          store.dispatch({
            type: 'serverReturnedHostPolicyResponse',
            payload: {
              policy_response: policyResponse,
            },
          });
        });
        return renderResult
          .findAllByTestId('hostDetailsPolicyResponseAttentionBadge')
          .catch((e) => {
            expect(e).not.toBeNull();
          });
      });

      it('should show a numbered badge if at least one action failed', async () => {
        const policyResponseActionDispatched = middlewareSpy.waitForAction(
          'serverReturnedHostPolicyResponse'
        );
        reactTestingLibrary.act(() => {
          dispatchServerReturnedHostPolicyResponse(HostPolicyResponseActionStatus.failure);
        });
        await policyResponseActionDispatched;
        const attentionBadge = await renderResult.findAllByTestId(
          'hostDetailsPolicyResponseAttentionBadge'
        );
        expect(attentionBadge).not.toBeNull();
      });

      it('should show a numbered badge if at least one action has a warning', async () => {
        const policyResponseActionDispatched = middlewareSpy.waitForAction(
          'serverReturnedHostPolicyResponse'
        );
        reactTestingLibrary.act(() => {
          dispatchServerReturnedHostPolicyResponse(HostPolicyResponseActionStatus.warning);
        });
        await policyResponseActionDispatched;
        const attentionBadge = await renderResult.findAllByTestId(
          'hostDetailsPolicyResponseAttentionBadge'
        );
        expect(attentionBadge).not.toBeNull();
      });

      it('should include the back to details link', async () => {
        const subHeaderBackLink = await renderResult.findByTestId('flyoutSubHeaderBackButton');
        expect(subHeaderBackLink.textContent).toBe('Endpoint Details');
        expect(subHeaderBackLink.getAttribute('href')).toBe(
          '/hosts?page_index=0&page_size=10&selected_host=1'
        );
      });

      it('should update URL when back to details link is clicked', async () => {
        const subHeaderBackLink = await renderResult.findByTestId('flyoutSubHeaderBackButton');
        const userChangedUrlChecker = middlewareSpy.waitForAction('userChangedUrl');
        reactTestingLibrary.act(() => {
          reactTestingLibrary.fireEvent.click(subHeaderBackLink);
        });
        const changedUrlAction = await userChangedUrlChecker;
        expect(changedUrlAction.payload.search).toEqual(
          '?page_index=0&page_size=10&selected_host=1'
        );
      });

      it('should format unknown policy action names', async () => {
        expect(renderResult.getByText('A New Unknown Action')).not.toBeNull();
      });
    });
  });
});
