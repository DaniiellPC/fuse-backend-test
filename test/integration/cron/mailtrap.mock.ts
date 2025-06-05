export const mockSendMail = jest.fn();

// This is the function that will be used as the implementation for nodemailer.createTransport
export const mockCreateTransportImpl = jest.fn((options?: any) => ({
  sendMail: mockSendMail,
}));

export const resetMailtrapMocks = () => {
  mockCreateTransportImpl.mockClear(); // Clear the implementation mock
  mockSendMail.mockClear();
};
