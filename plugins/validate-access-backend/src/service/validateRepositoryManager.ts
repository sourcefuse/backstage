import axios from 'axios';

// Function to check if a user is allowed
export const isUserAllowed = async (
  user: string
): Promise<boolean> => {
  try {
    const token = process.env.GITHUB_TOKEN; // GitHub token with appropriate permissions
    console.log(`${process.env.GITHUB_API_URL}/orgs/${process.env.GITHUB_ORGANIZATION}/teams/${process.env.REPO_CREATOR_TEAM}/memberships/${user} .........${process.env.GITHUB_TOKEN}`); // NOSONAR
    const response = await axios.get(
      `${process.env.GITHUB_API_URL}/orgs/${process.env.GITHUB_ORGANIZATION}/teams/${process.env.REPO_CREATOR_TEAM}/memberships/${user}`,
      {
        headers: {
          Authorization: `token ${token}`,
        },
      },
    );
    console.log('response.data-------',response,response.data); // NOSONAR
    const userAccess = response.data;
    return (
      userAccess.role &&
      ['member', 'admin', 'maintainer'].includes(userAccess.role) &&
      userAccess.state === 'active'
    );
  } catch (error) {
    console.log('error-------',error); // NOSONAR
    return false;
  }
};
