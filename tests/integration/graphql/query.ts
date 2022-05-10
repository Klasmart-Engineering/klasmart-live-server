import {
    gql
} from "@apollo/client";

export const QUERY_TOKEN = gql`
query token {
  token {
    subject
    audience
    userId
    userName
    isTeacher
    organization
    roomId
    materials {
      name
      url
    }
  }
}`;

export const QUERY_READY = gql`
  query ready {
    ready
  }
`;
